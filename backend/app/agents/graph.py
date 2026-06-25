"""
LangGraph StateGraph for the GitOne investigation pipeline.

Graph structure:
  START → investigator
  investigator ─(investigating)→ tool_executor → investigator   [loop]
  investigator ─(synthesizing)→ synthesizer
  synthesizer → critic
  critic ─(refining)→ investigator                              [bounded]
  critic ─(done)→ finalizer
  finalizer → END
"""
from langgraph.graph import END, START, StateGraph

from app.agents.nodes import (
    make_critic_node,
    make_finalizer_node,
    make_investigator_node,
    make_synthesizer_node,
    make_tool_executor_node,
)
from app.agents.state import GraphState
from app.config import settings


def _route_investigator(state: GraphState) -> str:
    """After investigator: tool_executor if there's a tool call, else synthesizer."""
    # Hard cap — force synthesis if we've hit the limit
    if state.get("iterations", 0) >= settings.MAX_ITERATIONS:
        return "synthesizer"
    if state.get("status") == "investigating":
        return "tool_executor"
    return "synthesizer"


def _route_critic(state: GraphState) -> str:
    """After critic: back to investigator if critical gaps remain, else finalize."""
    critique = state.get("critique", [])
    critical_flags = [f for f in critique if f.get("severity") == "critical"]
    # Track refine iterations via a sub-counter in log entries
    refine_count = sum(
        1 for step in state.get("log", [])
        if step.get("node") == "critic" and step.get("action") != "critique (stub)"
    )
    if critical_flags and refine_count < settings.MAX_REFINE_ITERATIONS:
        return "investigator"
    return "finalizer"


def build_graph(tools: list):
    """
    Build and compile the investigation graph.
    tools: list of LangChain tools from make_tool_registry()
    """
    investigator = make_investigator_node(tools)
    tool_executor = make_tool_executor_node(tools)
    synthesizer = make_synthesizer_node()
    critic = make_critic_node()
    finalizer = make_finalizer_node()

    g = StateGraph(GraphState)

    g.add_node("investigator", investigator)
    g.add_node("tool_executor", tool_executor)
    g.add_node("synthesizer", synthesizer)
    g.add_node("critic", critic)
    g.add_node("finalizer", finalizer)

    g.add_edge(START, "investigator")
    g.add_conditional_edges(
        "investigator",
        _route_investigator,
        {"tool_executor": "tool_executor", "synthesizer": "synthesizer"},
    )
    g.add_edge("tool_executor", "investigator")
    g.add_edge("synthesizer", "critic")
    g.add_conditional_edges(
        "critic",
        _route_critic,
        {"investigator": "investigator", "finalizer": "finalizer"},
    )
    g.add_edge("finalizer", END)

    return g.compile(checkpointer=None)
