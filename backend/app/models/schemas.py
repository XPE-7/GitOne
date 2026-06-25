from pydantic import BaseModel
from typing import Any, Optional


class InvestigateRequest(BaseModel):
    repo: str        # "owner/name"
    file_path: str
    line_start: int
    line_end: int


class InvestigateResponse(BaseModel):
    investigation_id: str


class Evidence(BaseModel):
    id: str
    type: str        # blame | commit | pr | issue | search | error
    source: str
    content: dict[str, Any] = {}
    summary: str = ""


class Claim(BaseModel):
    id: str
    text: str
    source_ids: list[str] = []
    verified: bool = False


class Flag(BaseModel):
    claim_id: str
    issue: str
    severity: str    # critical | minor


class CaseFile(BaseModel):
    narrative: str
    claims: list[Claim]
    critique: list[Flag]
    evidence_map: dict[str, Any]
