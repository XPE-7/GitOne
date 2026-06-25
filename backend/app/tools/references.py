import re
from typing import TypedDict


class Reference(TypedDict):
    type: str   # "pr_or_issue"
    number: int
    context: str  # the matched text snippet for the LLM


_PATTERNS = [
    # explicit closing keywords
    r"(?:fixes?|closes?|resolves?|reverts?)\s+#(\d+)",
    r"(?:fixes?|closes?|resolves?|reverts?)\s+GH-(\d+)",
    # bare hash refs
    r"(?<!\w)#(\d+)(?!\w)",
    # GH- style
    r"\bGH-(\d+)\b",
]

_COMPILED = [re.compile(p, re.IGNORECASE) for p in _PATTERNS]


def extract_references(text: str) -> list[Reference]:
    seen: set[int] = set()
    results: list[Reference] = []

    for pattern in _COMPILED:
        for match in pattern.finditer(text):
            number = int(match.group(1))
            if number in seen:
                continue
            seen.add(number)
            # grab a small context window around the match
            start = max(0, match.start() - 30)
            end = min(len(text), match.end() + 30)
            snippet = text[start:end].replace("\n", " ").strip()
            results.append({"type": "pr_or_issue", "number": number, "context": snippet})

    return results
