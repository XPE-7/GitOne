import asyncio
import os
import re
import shutil
import stat
from pathlib import Path

import git
import httpx

from app.config import settings

MAX_REPO_SIZE_KB = 500_000  # 500MB compressed, per GitHub's /repos size field


class RepoCache:
    """
    Caches a single cloned repo under cache_dir. Render's free tier only has
    2GB of /tmp, so we keep at most one repo on disk at a time — investigations
    are sequential, and wiping between clones keeps disk usage bounded.
    """

    def __init__(self, cache_dir: str):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self._lock = asyncio.Lock()
        self._current_repo: str | None = None

    def _safe_name(self, repo: str) -> str:
        return re.sub(r"[^\w]", "_", repo)

    async def get_repo(self, repo: str) -> Path:
        async with self._lock:
            dest = self.cache_dir / self._safe_name(repo)
            if self._current_repo == repo and (dest / ".git").exists():
                return dest

            await self._check_size(repo)
            await asyncio.to_thread(self._clone, repo, dest)
            self._current_repo = repo
            return dest

    async def _check_size(self, repo: str) -> None:
        headers = {"Accept": "application/vnd.github+json"}
        if settings.GITHUB_TOKEN:
            headers["Authorization"] = f"Bearer {settings.GITHUB_TOKEN}"

        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                resp = await client.get(f"https://api.github.com/repos/{repo}", headers=headers)
            except httpx.HTTPError as e:
                raise ValueError(f"Could not verify repo size for {repo}: {e}")

        if resp.status_code == 404:
            raise ValueError(f"Repo '{repo}' not found.")
        resp.raise_for_status()

        size_kb = resp.json().get("size", 0)
        if size_kb > MAX_REPO_SIZE_KB:
            raise ValueError(
                f"Repo is too large ({size_kb // 1024}MB) for the free tier. Try a smaller repo."
            )

    def _clone(self, repo: str, dest: Path) -> None:
        # Free tier only has 2GB of /tmp — keep at most one repo cloned at a time.
        # git marks pack files read-only, which makes plain rmtree silently no-op
        # on Windows (and can fail on Linux for root-owned files); clear the
        # read-only bit and retry on delete errors instead of swallowing them.
        def _on_rm_error(func, path, exc_info):
            os.chmod(path, stat.S_IWRITE)
            func(path)

        shutil.rmtree(str(self.cache_dir), onerror=_on_rm_error)
        self.cache_dir.mkdir(parents=True, exist_ok=True)

        url = f"https://github.com/{repo}.git"
        print(f"[RepoCache] Cloning {url} -> {dest}")
        git.Repo.clone_from(
            url,
            str(dest),
            multi_options=["--depth=1", "--filter=blob:none", "--no-tags"],
        )
        print(f"[RepoCache] Clone complete: {repo}")
