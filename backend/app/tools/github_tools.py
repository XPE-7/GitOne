"""
GitHub tool factory. Call make_github_tools(github_service, owner, repo) to get
LangChain-compatible tool functions closed over the given service + repo context.
"""
import json
import asyncio

from langchain_core.tools import tool

from app.services.github_service import GitHubService


def make_github_tools(github_service: GitHubService, owner: str, repo: str) -> list:

    def run_async(coro):
        """Run an async coroutine from a sync tool function."""
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as pool:
                    future = pool.submit(asyncio.run, coro)
                    return future.result()
            else:
                return loop.run_until_complete(coro)
        except RuntimeError:
            return asyncio.run(coro)

    @tool
    def get_pull_request(number: int) -> str:
        """
        Get details of a specific GitHub Pull Request by number.
        Returns the PR title, body, state, merge commit SHA, labels, and linked issue numbers.
        The body often contains the motivation, design decisions, and references to related issues.
        Use this when a commit message or blame entry references a PR number.
        """
        try:
            result = run_async(github_service.get_pull_request(owner, repo, number))
            return json.dumps(result, default=str)
        except Exception as e:
            return json.dumps({"error": str(e), "pr_number": number})

    @tool
    def search_pull_requests(query: str) -> str:
        """
        Search GitHub Pull Requests in this repository by keyword.
        Returns matching PRs with title, state, and number.
        Use this when you want to find PRs related to a feature, bug fix, or refactor
        but don't have a specific PR number.
        """
        try:
            result = run_async(github_service.search_pull_requests(owner, repo, query))
            return json.dumps({"pull_requests": result, "query": query}, default=str)
        except Exception as e:
            return json.dumps({"error": str(e), "query": query})

    @tool
    def get_issue(number: int) -> str:
        """
        Get details of a specific GitHub Issue by number.
        Returns the issue title, body, state, labels, and first 5 comments.
        Issues often contain the original bug report, design discussion, or feature request
        that explains WHY the code was written. Always read issues referenced in PRs or commits.
        """
        try:
            result = run_async(github_service.get_issue(owner, repo, number))
            return json.dumps(result, default=str)
        except Exception as e:
            return json.dumps({"error": str(e), "issue_number": number})

    @tool
    def search_issues(query: str) -> str:
        """
        Search GitHub Issues in this repository by keyword.
        Returns matching issues with title, state, and number.
        Use this to find the original bug report or feature request related to the code.
        """
        try:
            result = run_async(github_service.search_issues(owner, repo, query))
            return json.dumps({"issues": result, "query": query}, default=str)
        except Exception as e:
            return json.dumps({"error": str(e), "query": query})

    return [get_pull_request, search_pull_requests, get_issue, search_issues]
