"""
Tool registry factory. Creates all 9 tools bound to the given services + repo context.
"""
from app.services.git_service import GitService
from app.services.github_service import GitHubService
from app.tools.git_tools import make_git_tools
from app.tools.github_tools import make_github_tools


def make_tool_registry(
    git_service: GitService,
    github_service: GitHubService,
    owner: str,
    repo: str,
) -> list:
    """
    Returns a flat list of all 9 LangChain tools, each closed over the
    provided services and repo context. Pass this list to bind_tools() on the LLM.
    """
    git_tools = make_git_tools(git_service)
    github_tools = make_github_tools(github_service, owner, repo)
    return git_tools + github_tools


def tools_by_name(tools: list) -> dict:
    """Build a name→tool lookup for the tool executor node."""
    return {t.name: t for t in tools}
