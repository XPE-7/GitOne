import asyncio
import shutil
import time
import re
from pathlib import Path

import git


class RepoCache:
    def __init__(self, cache_dir: str, max_repos: int = 10):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.max_repos = max_repos
        self._repos: dict[str, Path] = {}
        self._locks: dict[str, asyncio.Lock] = {}
        self._access_times: dict[str, float] = {}

    def _safe_name(self, repo: str) -> str:
        return re.sub(r"[^\w]", "_", repo)

    def _get_lock(self, repo: str) -> asyncio.Lock:
        if repo not in self._locks:
            self._locks[repo] = asyncio.Lock()
        return self._locks[repo]

    async def get_repo(self, repo: str) -> Path:
        async with self._get_lock(repo):
            dest = self.cache_dir / self._safe_name(repo)
            if repo not in self._repos or not (dest / ".git").exists():
                await asyncio.to_thread(self._clone, repo, dest)
                self._repos[repo] = dest
            self._access_times[repo] = time.time()
            self._evict_if_needed()
            return dest

    def _clone(self, repo: str, dest: Path) -> None:
        if dest.exists() and (dest / ".git").exists():
            # Already cloned — fetch latest
            try:
                g = git.Repo(str(dest))
                g.remotes.origin.fetch()
                return
            except Exception:
                shutil.rmtree(str(dest), ignore_errors=True)

        url = f"https://github.com/{repo}.git"
        print(f"[RepoCache] Cloning {url} -> {dest}")
        git.Repo.clone_from(
            url,
            str(dest),
            multi_options=["--filter=blob:none"],
        )
        print(f"[RepoCache] Clone complete: {repo}")

    def _evict_if_needed(self) -> None:
        while len(self._repos) > self.max_repos:
            lru_repo = min(self._access_times, key=self._access_times.get)  # type: ignore
            path = self._repos.pop(lru_repo)
            self._access_times.pop(lru_repo, None)
            self._locks.pop(lru_repo, None)
            try:
                shutil.rmtree(str(path), ignore_errors=True)
                print(f"[RepoCache] Evicted {lru_repo}")
            except Exception:
                pass
