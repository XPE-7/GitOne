// Mirrors backend schemas.py — keep in sync

export interface InvestigateRequest {
  repo: string
  file_path: string
  line_start: number
  line_end: number
}

export interface InvestigateResponse {
  investigation_id: string
}

export interface Evidence {
  id: string
  type: 'blame' | 'commit' | 'pr' | 'issue' | 'search' | 'error'
  source: string
  content: Record<string, unknown>
  summary: string
}

export interface Claim {
  id: string
  text: string
  source_ids: string[]
  verified: boolean
}

export interface Flag {
  claim_id: string
  issue: string
  severity: 'critical' | 'minor'
}

export interface CaseFile {
  narrative: string
  claims: Claim[]
  critique: Flag[]
  evidence_map: Record<string, Evidence>
}

// SSE event payloads emitted by backend/app/api/streaming.py
export interface SSEHandlers {
  onNodeStart?:        (node: string) => void
  onToolCall?:         (tool: string, args: Record<string, string>) => void
  onToolResult?:       (tool: string, preview: string) => void
  onInvestigatorStep?: (rationale: string, status: string) => void
  onNarrative?:        (text: string, claimCount: number) => void
  onCritique?:         (flags: Flag[]) => void
  onDone?:             (caseFile: CaseFile) => void
  onError?:            (message: string) => void
}

// Trail step (frontend-only state for the animated trail)
export interface TrailStep {
  type: 'tool' | 'evidence' | 'synthesis' | 'critic' | 'node'
  label: string
  detail?: string
  isActive: boolean
  timestamp: number
}
