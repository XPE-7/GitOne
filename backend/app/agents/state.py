import operator
from datetime import datetime
from typing import Annotated, Any, TypedDict

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


# ── Evidence item ──────────────────────────────────────────────────────────────
# Stable IDs let claims cite specific evidence in the case file.

class Evidence(TypedDict):
    id: str          # e.g. "blame:abc1234:L400", "pr:482", "issue:471"
    type: str        # blame | commit | pr | issue | search | error
    source: str      # tool name that produced this
    content: dict    # raw result (compact)
    summary: str     # 1-2 sentence summary for the investigator to read


# ── Investigation step (for streaming + trail) ─────────────────────────────────

class InvestigationStep(TypedDict):
    node: str           # "investigator" | "tool_executor" | "synthesizer" | "critic"
    action: str         # e.g. "git_blame(src/requests/models.py, 400, 410)"
    rationale: str      # 1-line reason the investigator chose this step
    result_summary: str # compact result for the trail node
    timestamp: str


# ── Claim (synthesizer output, critic input) ───────────────────────────────────

class Claim(TypedDict):
    id: str
    text: str
    source_ids: list[str]   # evidence IDs that support this claim
    verified: bool           # set by finalizer based on critic output


# ── Critic flag ────────────────────────────────────────────────────────────────

class Flag(TypedDict):
    claim_id: str
    issue: str
    severity: str   # "critical" | "minor"


# ── Main graph state ───────────────────────────────────────────────────────────
# List fields use Annotated reducers so LangGraph appends rather than overwrites.
# messages uses add_messages (handles deduplication by message ID).

class GraphState(TypedDict):
    # ── Inputs (set once at start) ──
    repo: str
    file_path: str
    line_start: int
    line_end: int
    selected_code: str

    # ── LLM conversation (investigator <-> tool_executor) ──
    messages: Annotated[list[BaseMessage], add_messages]

    # ── Working memory ──
    hypothesis: str
    evidence: Annotated[list[Evidence], operator.add]
    log: Annotated[list[InvestigationStep], operator.add]
    iterations: int

    # ── Outputs ──
    narrative: str
    claims: Annotated[list[Claim], operator.add]
    critique: Annotated[list[Flag], operator.add]
    status: str      # investigating | synthesizing | critiquing | refining | done | failed
    case_file: dict


def make_initial_state(
    repo: str,
    file_path: str,
    line_start: int,
    line_end: int,
    selected_code: str,
) -> GraphState:
    return GraphState(
        repo=repo,
        file_path=file_path,
        line_start=line_start,
        line_end=line_end,
        selected_code=selected_code,
        messages=[],
        hypothesis="",
        evidence=[],
        log=[],
        iterations=0,
        narrative="",
        claims=[],
        critique=[],
        status="investigating",
        case_file={},
    )
