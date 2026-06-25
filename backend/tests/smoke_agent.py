"""
Smoke test — runs the full investigation graph in the terminal.
Streams LangGraph events so you can watch each tool call live.

Run from the backend/ directory:

    python -m tests.smoke_agent

Requires CEREBRAS_API_KEY and GITHUB_TOKEN in backend/.env.
"""
import asyncio
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

from app.services.repo_cache import RepoCache
from app.services.git_service import GitService
from app.services.github_service import GitHubService
from app.tools.registry import make_tool_registry
from app.agents.graph import build_graph
from app.agents.state import make_initial_state

REPO = "psf/requests"
FILE_PATH = "src/requests/models.py"
LINE_START = 946  # Response.__bool__
LINE_END = 952


async def main() -> None:
    if not os.getenv("CEREBRAS_API_KEY"):
        sys.exit("CEREBRAS_API_KEY not set in backend/.env")
    if not os.getenv("GITHUB_TOKEN"):
        print("WARNING: GITHUB_TOKEN not set — GitHub tool calls will be rate-limited")

    cache = RepoCache(cache_dir="/tmp/gitone_smoke", max_repos=3)
    print(f"Loading {REPO}…")
    repo_path = await cache.get_repo(REPO)

    git_svc = GitService(repo_path)
    github_svc = GitHubService(token=os.getenv("GITHUB_TOKEN", ""))
    owner, repo_name = REPO.split("/")

    try:
        full = git_svc.get_file_contents(FILE_PATH)
        snippet = "\n".join(
            f"{LINE_START + i:4d}  {l}"
            for i, l in enumerate(full.splitlines()[LINE_START - 1: LINE_END])
        )
    except Exception as e:
        snippet = f"# Could not read file: {e}"

    print(f"\nSelected code:\n{snippet}\n")

    tools = make_tool_registry(git_svc, github_svc, owner, repo_name)
    graph = build_graph(tools)
    state = make_initial_state(
        repo=REPO, file_path=FILE_PATH,
        line_start=LINE_START, line_end=LINE_END,
        selected_code=snippet,
    )

    step = 0
    async for event in graph.astream_events(state, version="v2", config={"recursion_limit": 50}):
        etype = event.get("event", "")
        name = event.get("name", "")
        data = event.get("data", {})

        if etype == "on_chain_start" and name in ("investigator", "tool_executor", "synthesizer", "critic", "finalizer"):
            step += 1
            print(f"\n[{step:02d}] {name.upper()}")

        elif etype == "on_tool_start":
            inp = data.get("input", {})
            print(f"     → {name}({json.dumps(inp)[:80]})")

        elif etype == "on_tool_end":
            preview = str(data.get("output", ""))[:120].replace("\n", " ")
            print(f"       ← {preview}")

        elif etype == "on_chain_end" and name == "finalizer":
            cf = data.get("output", {}).get("case_file", {})
            print(f"\n{'='*56}")
            print(f"  Done — {len(cf.get('evidence_map', {}))} evidence items")
            print(f"  {len(cf.get('claims', []))} claims, "
                  f"{sum(1 for c in cf.get('claims', []) if c.get('verified'))} verified")
            print(f"{'='*56}")
            print("\nNarrative preview:")
            print(cf.get("narrative", "")[:400])

    await github_svc.close()
    print("\nDone.\n")


if __name__ == "__main__":
    asyncio.run(main())
