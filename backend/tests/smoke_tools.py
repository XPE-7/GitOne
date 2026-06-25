"""
Smoke test — calls every tool directly against psf/requests (no LLM).
Run from the backend/ directory:

    python -m tests.smoke_tools

Requires GITHUB_TOKEN in backend/.env for GitHub API calls.
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
from app.tools.git_tools import make_git_tools
from app.tools.github_tools import make_github_tools
from app.tools.references import extract_references

REPO = "psf/requests"
OWNER, REPO_NAME = REPO.split("/")
TEST_FILE = "src/requests/models.py"


def _pp(label: str, result: str) -> None:
    bar = "─" * 56
    print(f"\n{bar}\n  {label}\n{bar}")
    try:
        print(json.dumps(json.loads(result), indent=2, default=str)[:1200])
    except Exception:
        print(result[:1200])


async def main() -> None:
    print(f"\nSmoke test — {REPO}\n")

    cache = RepoCache(cache_dir="/tmp/gitone_smoke", max_repos=3)
    print("Cloning repo (cached after first run)…")
    repo_path = await cache.get_repo(REPO)

    git_svc = GitService(repo_path)
    github_svc = GitHubService(token=os.getenv("GITHUB_TOKEN", ""))

    tools = {t.name: t for t in make_git_tools(git_svc) + make_github_tools(github_svc, OWNER, REPO_NAME)}

    # git_blame
    blame = tools["git_blame"].invoke({"file_path": TEST_FILE, "line_start": 1, "line_end": 10})
    _pp("git_blame", blame)
    first_sha = (json.loads(blame).get("blame_entries") or [{}])[0].get("sha")

    # get_commit
    if first_sha:
        _pp("get_commit", tools["get_commit"].invoke({"sha": first_sha}))

    # get_file_at_commit
    if first_sha:
        _pp("get_file_at_commit", tools["get_file_at_commit"].invoke({"file_path": TEST_FILE, "sha": first_sha}))

    # get_file_history
    _pp("get_file_history", tools["get_file_history"].invoke({"file_path": TEST_FILE, "limit": 5}))

    # search_commit_messages
    _pp("search_commit_messages", tools["search_commit_messages"].invoke({"query": "response", "limit": 5}))

    # extract_references
    refs = extract_references("Fixes #482, closes GH-123, reverts #99")
    _pp("extract_references", json.dumps({"refs": refs}))

    if not os.getenv("GITHUB_TOKEN"):
        print("\n  GITHUB_TOKEN not set — skipping GitHub API calls")
    else:
        _pp("get_pull_request", tools["get_pull_request"].invoke({"number": 5008}))
        _pp("get_issue", tools["get_issue"].invoke({"number": 2738}))
        _pp("search_pull_requests", tools["search_pull_requests"].invoke({"query": "response status"}))
        _pp("search_issues", tools["search_issues"].invoke({"query": "response bool"}))

    await github_svc.close()
    print("\n✓  Smoke test complete\n")


if __name__ == "__main__":
    asyncio.run(main())
