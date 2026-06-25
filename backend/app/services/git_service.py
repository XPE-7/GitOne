import subprocess
import json
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any

import git


@dataclass
class BlameEntry:
    sha: str
    author: str
    email: str
    timestamp: str
    line_number: int
    content: str


@dataclass
class CommitDetail:
    sha: str
    message: str
    author: str
    email: str
    date: str
    parents: list[str]
    files_changed: int
    insertions: int
    deletions: int
    changed_files: list[str]


@dataclass
class CommitSummary:
    sha: str
    author: str
    email: str
    date: str
    subject: str


@dataclass
class TreeEntry:
    path: str
    is_dir: bool


class GitService:
    def __init__(self, repo_path: Path):
        self.repo_path = repo_path
        self._repo = git.Repo(str(repo_path))

    # ── Blame ──────────────────────────────────────────────────────────────

    def blame(self, file_path: str, line_start: int, line_end: int) -> list[dict[str, Any]]:
        def _run_blame():
            return subprocess.run(
                ["git", "blame", "-L", f"{line_start},{line_end}", "--porcelain", file_path],
                cwd=str(self.repo_path),
                capture_output=True,
                text=True,
            )

        result = _run_blame()
        # If blame fails due to missing promisor objects (lazy fetch failure), retry once
        # after fetching missing blobs explicitly.
        if result.returncode != 0 and "promisor" in result.stderr:
            subprocess.run(
                ["git", "fetch", "--filter=blob:none", "origin"],
                cwd=str(self.repo_path),
                capture_output=True,
            )
            result = _run_blame()

        if result.returncode != 0:
            raise RuntimeError(f"git blame failed: {result.stderr.strip()}")
        return [asdict(e) for e in self._parse_porcelain_blame(result.stdout)]

    def _parse_porcelain_blame(self, output: str) -> list[BlameEntry]:
        entries: list[BlameEntry] = []
        current: dict[str, str] = {}
        line_num = 0

        for line in output.splitlines():
            if len(line) >= 40 and line[:40].replace("0", "").replace("a", "").replace(
                "b", "").replace("c", "").replace("d", "").replace("e", "").replace(
                "f", "").isalnum() or (len(line) > 40 and line[40] == " "):
                # SHA header line: "<sha> <orig-line> <result-line> [num-lines]"
                parts = line.split()
                if len(parts) >= 3 and len(parts[0]) == 40:
                    current["sha"] = parts[0]
                    line_num = int(parts[2])
            elif line.startswith("author "):
                current["author"] = line[7:]
            elif line.startswith("author-mail "):
                current["email"] = line[12:].strip("<>")
            elif line.startswith("author-time "):
                current["timestamp"] = line[12:]
            elif line.startswith("\t"):
                # Actual code content line
                entries.append(BlameEntry(
                    sha=current.get("sha", ""),
                    author=current.get("author", ""),
                    email=current.get("email", ""),
                    timestamp=current.get("timestamp", ""),
                    line_number=line_num,
                    content=line[1:],  # strip the leading tab
                ))
                current = {}

        return entries

    # ── Commit detail ──────────────────────────────────────────────────────

    def get_commit(self, sha: str) -> dict[str, Any]:
        try:
            commit = self._repo.commit(sha)
        except Exception as e:
            raise ValueError(f"Commit {sha} not found: {e}")

        stats = commit.stats
        return asdict(CommitDetail(
            sha=commit.hexsha,
            message=commit.message.strip(),
            author=str(commit.author.name),
            email=str(commit.author.email),
            date=commit.committed_datetime.isoformat(),
            parents=[p.hexsha for p in commit.parents],
            files_changed=stats.total["files"],
            insertions=stats.total["insertions"],
            deletions=stats.total["deletions"],
            changed_files=list(stats.files.keys())[:20],  # cap to 20
        ))

    # ── File at commit ─────────────────────────────────────────────────────

    def get_file_at_commit(self, file_path: str, sha: str) -> str:
        try:
            return self._repo.git.show(f"{sha}:{file_path}")
        except git.GitCommandError as e:
            raise ValueError(f"File {file_path} not found at {sha}: {e}")

    # ── File history ───────────────────────────────────────────────────────

    def get_file_history(self, file_path: str, limit: int = 20) -> list[dict[str, Any]]:
        raw = self._repo.git.log(
            "--follow",
            f"--format=%H|%an|%ae|%aI|%s",
            f"-{limit}",
            "--",
            file_path,
        )
        return [asdict(self._parse_summary_line(l)) for l in raw.splitlines() if l.strip()]

    # ── Search commit messages ─────────────────────────────────────────────

    def search_commit_messages(self, query: str, limit: int = 20) -> list[dict[str, Any]]:
        # Strip characters that could escape the --grep value or inject git flags
        safe_query = query.replace("\n", " ").replace("\r", "")[:200]
        raw = self._repo.git.log(
            "--all",
            f"--format=%H|%an|%ae|%aI|%s",
            f"--grep={safe_query}",
            "--regexp-ignore-case",
            f"-{min(limit, 50)}",
        )
        return [asdict(self._parse_summary_line(l)) for l in raw.splitlines() if l.strip()]

    def _parse_summary_line(self, line: str) -> CommitSummary:
        parts = line.split("|", 4)
        return CommitSummary(
            sha=parts[0] if len(parts) > 0 else "",
            author=parts[1] if len(parts) > 1 else "",
            email=parts[2] if len(parts) > 2 else "",
            date=parts[3] if len(parts) > 3 else "",
            subject=parts[4] if len(parts) > 4 else "",
        )

    # ── File tree ──────────────────────────────────────────────────────────

    def get_file_tree(self, ref: str = "HEAD") -> list[str]:
        raw = self._repo.git.ls_tree("-r", "--name-only", ref)
        return [l for l in raw.splitlines() if l.strip()]

    # ── File contents ──────────────────────────────────────────────────────

    def get_file_contents(self, file_path: str, ref: str = "HEAD") -> str:
        try:
            return self._repo.git.show(f"{ref}:{file_path}")
        except git.GitCommandError as e:
            raise ValueError(f"Could not read {file_path} at {ref}: {e}")
