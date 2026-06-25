"""
LangGraph node implementations for the GitOne investigation graph.

Node factory pattern: each node is created via a make_*_node() factory
that closes over services/tools so the node functions themselves are
pure state-in -> state-out with no global dependencies.
"""
import asyncio
import json
import re
import time
from datetime import datetime, timezone
from typing import Any

from langchain_openai import ChatOpenAI
from langchain_core.messages import (
    AIMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)

from app.agents.prompts import CRITIC_SYSTEM, INVESTIGATOR_SYSTEM, SYNTHESIZER_SYSTEM
from app.agents.state import Claim, Evidence, Flag, GraphState, InvestigationStep
from app.config import settings


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _tool_to_evidence_type(tool_name: str) -> str:
    mapping = {
        "git_blame": "blame",
        "get_commit": "commit",
        "get_file_at_commit": "commit",
        "get_file_history": "commit",
        "search_commit_messages": "search",
        "get_pull_request": "pr",
        "search_pull_requests": "search",
        "get_issue": "issue",
        "search_issues": "search",
    }
    return mapping.get(tool_name, "search")


def _extract_rationale(content: str | list) -> str:
    """Pull the 'Rationale: ...' line from the model's text response."""
    if isinstance(content, list):
        text = " ".join(c.get("text", "") if isinstance(c, dict) else str(c) for c in content)
    else:
        text = content or ""
    match = re.search(r"Rationale:\s*(.+?)(?:\n|$)", text, re.IGNORECASE)
    return match.group(1).strip() if match else text[:200].strip()


def _evidence_id(tool_name: str, args: dict) -> str:
    """Generate a stable, human-readable evidence ID."""
    if tool_name == "git_blame":
        return f"blame:{args.get('file_path','?')}:L{args.get('line_start')}-{args.get('line_end')}"
    if tool_name == "get_commit":
        return f"commit:{str(args.get('sha',''))[:7]}"
    if tool_name == "get_file_at_commit":
        return f"file:{str(args.get('sha',''))[:7]}:{args.get('file_path','?')}"
    if tool_name == "get_file_history":
        return f"history:{args.get('file_path','?')}"
    if tool_name == "search_commit_messages":
        return f"search:commits:{args.get('query','?')}"
    if tool_name == "get_pull_request":
        return f"pr:{args.get('number')}"
    if tool_name == "search_pull_requests":
        return f"search:prs:{args.get('query','?')}"
    if tool_name == "get_issue":
        return f"issue:{args.get('number')}"
    if tool_name == "search_issues":
        return f"search:issues:{args.get('query','?')}"
    return f"{tool_name}:{int(time.time())}"


# ── Investigator node ──────────────────────────────────────────────────────────

def _make_llm(model: str, max_tokens: int = 2048, temperature: float = 0.2):
    return ChatOpenAI(
        model=model,
        api_key=settings.CEREBRAS_API_KEY,
        base_url="https://api.cerebras.ai/v1",
        max_tokens=max_tokens,
        temperature=temperature,
    )


def make_investigator_node(tools: list):
    llm = _make_llm(settings.INVESTIGATOR_MODEL).bind_tools(tools)

    async def investigator_node(state: GraphState) -> dict:
        messages = list(state.get("messages", []))

        # First call: inject system prompt + initial human message
        if not messages:
            owner_repo = state["repo"]
            messages = [
                SystemMessage(content=INVESTIGATOR_SYSTEM),
                HumanMessage(content=(
                    f"Investigate why this code exists in {owner_repo}.\n\n"
                    f"File: {state['file_path']}\n"
                    f"Lines {state['line_start']}-{state['line_end']}:\n\n"
                    f"```\n{state['selected_code']}\n```\n\n"
                    "Begin your investigation. Start with git_blame on these lines."
                )),
            ]
        else:
            # Trim history to stay within Groq free-tier TPM limits.
            # Keep: SystemMessage (index 0) + first HumanMessage (index 1) + last 6 messages.
            # Tool results are the biggest token consumers; dropping old ones is safe
            # because evidence is already stored in state["evidence"].
            if len(messages) > 8:
                head = messages[:2]   # system + initial human
                tail = messages[-6:]  # most recent exchanges
                messages = head + tail

        # Truncate individual tool result messages to 800 chars each
        trimmed = []
        for m in messages:
            if hasattr(m, 'content') and isinstance(m.content, str) and len(m.content) > 800:
                from langchain_core.messages import ToolMessage as TM
                if isinstance(m, TM):
                    trimmed.append(TM(content=m.content[:800] + "…[truncated]", tool_call_id=m.tool_call_id))
                    continue
            trimmed.append(m)
        messages = trimmed

        # Hard cap: if we've hit the iteration limit, force synthesis without calling LLM
        if state.get("iterations", 0) >= settings.MAX_ITERATIONS:
            return {
                "status": "synthesizing",
                "log": [InvestigationStep(
                    node="investigator",
                    action="ITERATION CAP REACHED",
                    rationale="Max iterations reached, proceeding to synthesis",
                    result_summary="",
                    timestamp=_now(),
                )],
            }

        response: AIMessage = await llm.ainvoke(messages)

        rationale = _extract_rationale(response.content)

        updates: dict[str, Any] = {"messages": [response]}

        if response.tool_calls:
            tc = response.tool_calls[0]
            updates["log"] = [InvestigationStep(
                node="investigator",
                action=f"{tc['name']}({json.dumps(tc['args'])[:120]})",
                rationale=rationale,
                result_summary="",
                timestamp=_now(),
            )]
            updates["status"] = "investigating"
        else:
            updates["status"] = "synthesizing"
            updates["log"] = [InvestigationStep(
                node="investigator",
                action="INVESTIGATION COMPLETE",
                rationale=rationale,
                result_summary="Moving to synthesis",
                timestamp=_now(),
            )]

        return updates

    return investigator_node


# ── Tool executor node ─────────────────────────────────────────────────────────

def make_tool_executor_node(tools: list):
    tools_by_name = {t.name: t for t in tools}

    async def tool_executor_node(state: GraphState) -> dict:
        last_msg: AIMessage = state["messages"][-1]
        if not hasattr(last_msg, "tool_calls") or not last_msg.tool_calls:
            return {"status": "synthesizing"}

        tool_messages: list[ToolMessage] = []
        evidence_items: list[Evidence] = []
        log_steps: list[InvestigationStep] = []

        for tc in last_msg.tool_calls:
            tool_name: str = tc["name"]
            tool_args: dict = tc["args"]
            tool_call_id: str = tc["id"]

            tool_fn = tools_by_name.get(tool_name)
            if tool_fn is None:
                content = json.dumps({"error": f"Unknown tool: {tool_name}"})
            else:
                try:
                    content = await asyncio.to_thread(tool_fn.invoke, tool_args)
                except Exception as exc:
                    content = json.dumps({"error": str(exc)})

            tool_messages.append(ToolMessage(content=content, tool_call_id=tool_call_id))

            ev_id = _evidence_id(tool_name, tool_args)
            try:
                parsed = json.loads(content)
            except Exception:
                parsed = {"raw": content}

            summary = content[:300]
            if isinstance(parsed, dict):
                if "error" in parsed:
                    summary = f"ERROR: {parsed['error'][:200]}"
                elif "message" in parsed:
                    summary = str(parsed["message"])[:300]
                elif "title" in parsed:
                    summary = str(parsed["title"])[:300]
                elif "blame_entries" in parsed:
                    entries = parsed["blame_entries"]
                    shas = list({e["sha"][:7] for e in entries})
                    summary = f"Blame: {len(entries)} lines, commits {', '.join(shas[:3])}"
                elif "commits" in parsed:
                    n = len(parsed["commits"])
                    summary = f"{n} commits found"

            evidence_items.append(Evidence(
                id=ev_id,
                type=_tool_to_evidence_type(tool_name),
                source=tool_name,
                content=parsed if len(content) < 8000 else {"truncated": True},
                summary=summary,
            ))

            log_steps.append(InvestigationStep(
                node="tool_executor",
                action=f"{tool_name}",
                rationale="",
                result_summary=summary,
                timestamp=_now(),
            ))

        return {
            "messages": tool_messages,
            "evidence": evidence_items,
            "log": log_steps,
            "iterations": state.get("iterations", 0) + 1,
        }

    return tool_executor_node


# ── Synthesizer node ───────────────────────────────────────────────────────────

def make_synthesizer_node():
    llm = _make_llm(settings.INVESTIGATOR_MODEL, max_tokens=4096)

    async def synthesizer_node(state: GraphState) -> dict:
        evidence: list[Evidence] = state.get("evidence", [])

        evidence_block = json.dumps(
            [{"id": ev["id"], "type": ev["type"], "summary": ev["summary"], "content": ev["content"]}
             for ev in evidence],
            indent=2, default=str,
        )

        prompt = (
            f"Selected code ({state['file_path']} lines {state['line_start']}-{state['line_end']}):\n"
            f"```\n{state['selected_code']}\n```\n\n"
            f"Evidence collected:\n{evidence_block}\n\n"
            "Write the case file narrative and claims. Follow the output format exactly."
        )

        messages = [SystemMessage(content=SYNTHESIZER_SYSTEM), HumanMessage(content=prompt)]
        response: AIMessage = await llm.ainvoke(messages)
        text = response.content if isinstance(response.content, str) else str(response.content)

        parts = text.split("---CLAIMS---", 1)
        narrative = parts[0].strip()
        claims: list[Claim] = []

        if len(parts) > 1:
            raw = parts[1].strip()
            m = re.search(r"```json\s*([\s\S]*?)```", raw, re.IGNORECASE)
            json_str = m.group(1).strip() if m else raw
            try:
                parsed = json.loads(json_str)
                for item in parsed:
                    claims.append(Claim(
                        id=item.get("id", f"claim-{len(claims)+1}"),
                        text=item.get("text", ""),
                        source_ids=item.get("source_ids", []),
                        verified=False,
                    ))
            except (json.JSONDecodeError, KeyError):
                pass

        return {
            "narrative": narrative,
            "claims": claims,
            "status": "critiquing",
            "log": [InvestigationStep(
                node="synthesizer",
                action="synthesize",
                rationale="",
                result_summary=f"{len(claims)} claims extracted",
                timestamp=_now(),
            )],
        }

    return synthesizer_node


# ── Critic node ────────────────────────────────────────────────────────────────

def make_critic_node():
    llm = _make_llm(settings.CRITIC_MODEL, max_tokens=1024, temperature=0.1)

    async def critic_node(state: GraphState) -> dict:
        claims: list[Claim] = state.get("claims", [])
        evidence_map = {ev["id"]: ev for ev in state.get("evidence", [])}

        cited_ids = {sid for c in claims for sid in c.get("source_ids", [])}
        cited_evidence = {eid: evidence_map[eid] for eid in cited_ids if eid in evidence_map}

        prompt = (
            f"Claims to review:\n{json.dumps(claims, indent=2, default=str)}\n\n"
            f"Cited evidence:\n{json.dumps(cited_evidence, indent=2, default=str)}\n\n"
            "Output only the JSON flag array."
        )

        messages = [SystemMessage(content=CRITIC_SYSTEM), HumanMessage(content=prompt)]
        response: AIMessage = await llm.ainvoke(messages)
        text = response.content if isinstance(response.content, str) else str(response.content)

        flags: list[Flag] = []
        m = re.search(r"```json\s*([\s\S]*?)```", text, re.IGNORECASE)
        json_str = m.group(1).strip() if m else text.strip()
        try:
            parsed = json.loads(json_str)
            for item in parsed:
                flags.append(Flag(
                    claim_id=item.get("claim_id", ""),
                    issue=item.get("issue", ""),
                    severity=item.get("severity", "minor"),
                ))
        except (json.JSONDecodeError, KeyError):
            pass

        critical = [f for f in flags if f.get("severity") == "critical"]
        refine_count = sum(
            1 for step in state.get("log", [])
            if step.get("node") == "critic"
        )
        next_status = (
            "refining"
            if critical and refine_count < settings.MAX_REFINE_ITERATIONS
            else "done"
        )

        return {
            "critique": flags,
            "status": next_status,
            "log": [InvestigationStep(
                node="critic",
                action="critique",
                rationale="",
                result_summary=f"{len(flags)} flags ({len(critical)} critical)",
                timestamp=_now(),
            )],
        }

    return critic_node


# ── Finalizer node ─────────────────────────────────────────────────────────────

def make_finalizer_node():
    async def finalizer_node(state: GraphState) -> dict:
        critique: list[Flag] = state.get("critique", [])
        flagged_ids = {f["claim_id"] for f in critique}

        claims: list[Claim] = [
            {**c, "verified": c["id"] not in flagged_ids}
            for c in state.get("claims", [])
        ]

        evidence_map = {ev["id"]: ev for ev in state.get("evidence", [])}

        case_file = {
            "narrative": state.get("narrative", ""),
            "claims": claims,
            "critique": critique,
            "evidence_map": evidence_map,
        }

        return {
            "status": "done",
            "case_file": case_file,
            "log": [InvestigationStep(
                node="finalizer",
                action="finalize",
                rationale="",
                result_summary=f"{len(claims)} claims, {len(critique)} flags",
                timestamp=_now(),
            )],
        }

    return finalizer_node
