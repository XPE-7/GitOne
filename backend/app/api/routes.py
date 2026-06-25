import json
import logging
import re
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

from sse_starlette.sse import EventSourceResponse

from app.agents.graph import build_graph
from app.agents.state import make_initial_state
from app.api.streaming import investigation_event_stream
from app.config import settings
from app.models.schemas import InvestigateRequest, InvestigateResponse
from app.services.git_service import GitService
from app.services.github_service import GitHubService
from app.services.repo_cache import RepoCache
from app.tools.registry import make_tool_registry

logger = logging.getLogger(__name__)

router = APIRouter()

_investigations: dict[str, tuple[dict, object]] = {}

_repo_cache = RepoCache(
    cache_dir=settings.REPO_CACHE_DIR,
    max_repos=10,
)

# owner/repo — alphanumeric, hyphens, underscores, dots only
_REPO_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}/[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$")


def _validate_repo(repo: str) -> tuple[str, str]:
    if not _REPO_RE.match(repo):
        raise HTTPException(status_code=400, detail="Invalid repo format. Use 'owner/name'.")
    owner, name = repo.split("/", 1)
    return owner, name


def _validate_path(repo_path: Path, file_path: str) -> None:
    """Reject paths that escape the cloned repo root."""
    if ".." in file_path or file_path.startswith("/") or file_path.startswith("\\"):
        raise HTTPException(status_code=400, detail="Invalid file path.")
    resolved = (repo_path / file_path).resolve()
    if not str(resolved).startswith(str(repo_path.resolve())):
        raise HTTPException(status_code=400, detail="Invalid file path.")


@router.post("/investigate", response_model=InvestigateResponse)
async def start_investigation(request: InvestigateRequest):
    owner, repo_name = _validate_repo(request.repo)

    if request.line_start < 1 or request.line_end < request.line_start or request.line_end - request.line_start > 500:
        raise HTTPException(status_code=400, detail="line_start/line_end out of range (max 500 lines).")

    try:
        repo_path: Path = await _repo_cache.get_repo(request.repo)
    except Exception:
        logger.exception("Failed to clone repo %s", request.repo)
        raise HTTPException(status_code=502, detail="Could not clone repository. Check the repo name and try again.")

    _validate_path(repo_path, request.file_path)

    git_svc = GitService(repo_path)
    github_svc = GitHubService(token=settings.GITHUB_TOKEN)

    try:
        full_file = git_svc.get_file_contents(request.file_path)
        lines = full_file.splitlines()
        selected_lines = lines[request.line_start - 1: request.line_end]
        selected_code = "\n".join(
            f"{request.line_start + i:4d}  {line}"
            for i, line in enumerate(selected_lines)
        )
    except Exception:
        logger.exception("Could not read %s from %s", request.file_path, request.repo)
        selected_code = f"# Could not read selected lines."

    tools = make_tool_registry(git_svc, github_svc, owner, repo_name)
    graph = build_graph(tools)

    initial_state = make_initial_state(
        repo=request.repo,
        file_path=request.file_path,
        line_start=request.line_start,
        line_end=request.line_end,
        selected_code=selected_code,
    )

    investigation_id = uuid.uuid4().hex[:12]
    _investigations[investigation_id] = (initial_state, graph)
    logger.info("Started investigation %s for %s:%s", investigation_id, request.repo, request.file_path)

    return InvestigateResponse(investigation_id=investigation_id)


@router.get("/investigate/{investigation_id}/stream")
async def stream_investigation(investigation_id: str):
    # Validate ID format to avoid log injection
    if not re.match(r"^[a-f0-9]{12}$", investigation_id):
        raise HTTPException(status_code=400, detail="Invalid investigation ID.")

    entry = _investigations.get(investigation_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Investigation not found or already completed.")

    initial_state, graph = entry

    async def event_generator():
        async for payload in investigation_event_stream(initial_state, graph):
            yield {
                "event": payload.get("type", "message"),
                "data": json.dumps(payload, default=str),
            }
        _investigations.pop(investigation_id, None)

    return EventSourceResponse(event_generator())


@router.get("/repos/{owner}/{repo}/tree")
async def get_repo_tree(owner: str, repo: str, ref: str = "HEAD"):
    _validate_repo(f"{owner}/{repo}")
    # Restrict ref to safe values
    if not re.match(r"^[a-zA-Z0-9_./\-]{1,200}$", ref):
        raise HTTPException(status_code=400, detail="Invalid ref.")

    try:
        repo_path = await _repo_cache.get_repo(f"{owner}/{repo}")
    except Exception:
        logger.exception("Failed to clone %s/%s", owner, repo)
        raise HTTPException(status_code=502, detail="Could not clone repository.")

    git_svc = GitService(repo_path)
    try:
        tree = git_svc.get_file_tree(ref=ref)
        return {"entries": tree}
    except Exception:
        logger.exception("get_file_tree failed for %s/%s at %s", owner, repo, ref)
        raise HTTPException(status_code=500, detail="Failed to read file tree.")


@router.get("/repos/{owner}/{repo}/file")
async def get_file(
    owner: str,
    repo: str,
    path: str = Query(..., description="File path within the repo"),
    ref: str = "HEAD",
):
    _validate_repo(f"{owner}/{repo}")
    if not re.match(r"^[a-zA-Z0-9_./\-]{1,200}$", ref):
        raise HTTPException(status_code=400, detail="Invalid ref.")

    try:
        repo_path = await _repo_cache.get_repo(f"{owner}/{repo}")
    except Exception:
        logger.exception("Failed to clone %s/%s", owner, repo)
        raise HTTPException(status_code=502, detail="Could not clone repository.")

    _validate_path(repo_path, path)

    git_svc = GitService(repo_path)
    try:
        content = git_svc.get_file_contents(path, ref=ref)
        return {"content": content, "path": path, "ref": ref}
    except Exception:
        logger.exception("get_file_contents failed: %s/%s %s", owner, repo, path)
        raise HTTPException(status_code=404, detail="File not found.")
