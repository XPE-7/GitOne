import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)


class GitHubService:
    BASE_URL = "https://api.github.com"

    def __init__(self, token: str):
        self._client = httpx.AsyncClient(
            base_url=self.BASE_URL,
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
            timeout=30.0,
        )

    async def get_pull_request(self, owner: str, repo: str, number: int) -> dict[str, Any]:
        r = await self._client.get(f"/repos/{owner}/{repo}/pulls/{number}")
        self._check_rate_limit(r)
        r.raise_for_status()
        data = r.json()
        return self._trim_pr(data)

    async def search_pull_requests(self, owner: str, repo: str, query: str) -> list[dict[str, Any]]:
        r = await self._client.get(
            "/search/issues",
            params={"q": f"repo:{owner}/{repo} is:pr {query}", "per_page": 10},
        )
        self._check_rate_limit(r)
        r.raise_for_status()
        items = r.json().get("items", [])
        return [self._trim_issue(i) for i in items]

    async def get_issue(self, owner: str, repo: str, number: int) -> dict[str, Any]:
        r = await self._client.get(f"/repos/{owner}/{repo}/issues/{number}")
        self._check_rate_limit(r)
        r.raise_for_status()
        data = r.json()
        # Also fetch first page of comments if there are any
        comments: list[dict] = []
        if data.get("comments", 0) > 0:
            cr = await self._client.get(
                f"/repos/{owner}/{repo}/issues/{number}/comments",
                params={"per_page": 5},
            )
            if cr.is_success:
                comments = [{"author": c["user"]["login"], "body": c["body"][:500]} for c in cr.json()]
        return self._trim_issue(data, comments)

    async def search_issues(self, owner: str, repo: str, query: str) -> list[dict[str, Any]]:
        r = await self._client.get(
            "/search/issues",
            params={"q": f"repo:{owner}/{repo} is:issue {query}", "per_page": 10},
        )
        self._check_rate_limit(r)
        r.raise_for_status()
        items = r.json().get("items", [])
        return [self._trim_issue(i) for i in items]

    def _check_rate_limit(self, response: httpx.Response) -> None:
        remaining = response.headers.get("x-ratelimit-remaining")
        if remaining and int(remaining) < 100:
            logger.warning("GitHub API rate limit low: %s requests remaining", remaining)

    def _trim_pr(self, data: dict) -> dict:
        return {
            "number": data.get("number"),
            "title": data.get("title"),
            "state": data.get("state"),
            "body": (data.get("body") or "")[:2000],
            "merged_at": data.get("merged_at"),
            "merge_commit_sha": data.get("merge_commit_sha"),
            "html_url": data.get("html_url"),
            "user": data.get("user", {}).get("login"),
            "labels": [l["name"] for l in data.get("labels", [])],
            "linked_issues": self._extract_closing_refs(data.get("body") or ""),
        }

    def _trim_issue(self, data: dict, comments: list | None = None) -> dict:
        return {
            "number": data.get("number"),
            "title": data.get("title"),
            "state": data.get("state"),
            "body": (data.get("body") or "")[:2000],
            "html_url": data.get("html_url"),
            "user": data.get("user", {}).get("login"),
            "labels": [l["name"] for l in data.get("labels", [])],
            "comments": comments or [],
        }

    def _extract_closing_refs(self, text: str) -> list[int]:
        import re
        pattern = r"(?:closes?|fixes?|resolves?)\s+#(\d+)"
        return [int(m) for m in re.findall(pattern, text, re.IGNORECASE)]

    async def close(self) -> None:
        await self._client.aclose()

    async def __aenter__(self) -> "GitHubService":
        return self

    async def __aexit__(self, *_) -> None:
        await self.close()
