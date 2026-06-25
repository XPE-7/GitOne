"""
Git tool factory. Call make_git_tools(git_service) to get a list of
LangChain-compatible tool functions closed over the given service instance.
"""
import json
from typing import Any

from langchain_core.tools import tool

from app.services.git_service import GitService


def make_git_tools(git_service: GitService) -> list:

    @tool
    def git_blame(file_path: str, line_start: int, line_end: int) -> str:
        """
        Run git blame on a range of lines in a file.
        Returns a list of blame entries showing which commit last modified each line,
        along with the author, timestamp, and line content.
        Use this as your first step to find which commits are responsible for selected code.
        """
        try:
            result = git_service.blame(file_path, line_start, line_end)
            # Deduplicate by SHA for compactness
            seen: set[str] = set()
            unique: list[dict[str, Any]] = []
            for entry in result:
                if entry["sha"] not in seen:
                    seen.add(entry["sha"])
                    unique.append(entry)
            return json.dumps({"blame_entries": unique, "total_lines": len(result)}, default=str)
        except Exception as e:
            return json.dumps({"error": str(e)})

    @tool
    def get_commit(sha: str) -> str:
        """
        Get full details of a commit by its SHA.
        Returns the commit message, author, date, parent SHAs, and list of changed files.
        Look for PR/issue references in the message (e.g. 'fixes #482', 'revert of #123').
        """
        try:
            result = git_service.get_commit(sha)
            return json.dumps(result, default=str)
        except Exception as e:
            return json.dumps({"error": str(e)})

    @tool
    def get_file_at_commit(file_path: str, sha: str) -> str:
        """
        Get the contents of a file at a specific commit SHA.
        Useful for seeing what the code looked like before a change,
        or understanding the context around a modification.
        Returns the raw file content (truncated to 4000 chars if large).
        """
        try:
            content = git_service.get_file_at_commit(file_path, sha)
            if len(content) > 4000:
                content = content[:4000] + "\n... (truncated)"
            return json.dumps({"content": content, "sha": sha, "file_path": file_path})
        except Exception as e:
            return json.dumps({"error": str(e)})

    @tool
    def get_file_history(file_path: str, limit: int = 20) -> str:
        """
        Get the commit history for a specific file (follows renames).
        Returns commits in reverse chronological order with SHA, author, date, and subject.
        Use this to see the full evolution of a file and identify key change points.
        """
        try:
            result = git_service.get_file_history(file_path, limit)
            return json.dumps({"commits": result, "file_path": file_path}, default=str)
        except Exception as e:
            return json.dumps({"error": str(e)})

    @tool
    def search_commit_messages(query: str, limit: int = 15) -> str:
        """
        Search all commit messages for a keyword or phrase (case-insensitive grep).
        Useful for finding commits that reference a specific issue, feature, or decision.
        Returns matching commits with SHA, author, date, and subject.
        """
        try:
            result = git_service.search_commit_messages(query, limit)
            return json.dumps({"commits": result, "query": query}, default=str)
        except Exception as e:
            return json.dumps({"error": str(e)})

    return [git_blame, get_commit, get_file_at_commit, get_file_history, search_commit_messages]
