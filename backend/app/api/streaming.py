import asyncio
import json
import logging
from typing import AsyncGenerator

logger = logging.getLogger(__name__)

_STREAM_TIMEOUT_SECONDS = 300  # 5 minutes max per investigation


async def investigation_event_stream(
    initial_state: dict,
    graph,
) -> AsyncGenerator[dict, None]:
    try:
        async with asyncio.timeout(_STREAM_TIMEOUT_SECONDS):
            async for event in graph.astream_events(initial_state, version="v2"):
                etype = event.get("event", "")
                name = event.get("name", "")
                data = event.get("data", {})

                if etype == "on_chain_start" and name in (
                    "investigator", "tool_executor", "synthesizer", "critic", "finalizer"
                ):
                    yield {"type": "node_start", "node": name}

                elif etype == "on_tool_start":
                    inp = data.get("input", {})
                    yield {
                        "type": "tool_call",
                        "tool": name,
                        "args": {k: str(v)[:200] for k, v in (inp or {}).items()},
                    }

                elif etype == "on_tool_end":
                    out = data.get("output", "")
                    yield {"type": "tool_result", "tool": name, "preview": str(out)[:300]}

                elif etype == "on_chain_end" and name == "investigator":
                    output = data.get("output", {})
                    log = output.get("log", [])
                    rationale = log[-1].get("rationale", "") if log else ""
                    yield {"type": "investigator_step", "rationale": rationale, "status": output.get("status", "")}

                elif etype == "on_chain_end" and name == "synthesizer":
                    output = data.get("output", {})
                    yield {
                        "type": "narrative",
                        "text": output.get("narrative", ""),
                        "claim_count": len(output.get("claims", [])),
                    }

                elif etype == "on_chain_end" and name == "critic":
                    output = data.get("output", {})
                    yield {"type": "critique", "flags": output.get("critique", [])}

                elif etype == "on_chain_end" and name == "finalizer":
                    output = data.get("output", {})
                    yield {"type": "done", "case_file": output.get("case_file", {})}

    except asyncio.TimeoutError:
        logger.warning("Investigation timed out after %ds", _STREAM_TIMEOUT_SECONDS)
        yield {"type": "error", "message": "Investigation timed out. Try selecting fewer lines."}
    except Exception:
        logger.exception("Investigation stream error")
        yield {"type": "error", "message": "An unexpected error occurred. Please try again."}
