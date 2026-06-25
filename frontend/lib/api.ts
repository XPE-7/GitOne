import type { InvestigateRequest, InvestigateResponse, SSEHandlers, CaseFile, Flag } from './types'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000'

export async function investigate(req: InvestigateRequest): Promise<string> {
  const res = await fetch(`${BACKEND_URL}/api/investigate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { detail?: string }
    throw new Error(err.detail ?? `Request failed: ${res.status}`)
  }
  const data = await res.json() as InvestigateResponse
  return data.investigation_id
}

export function streamInvestigation(id: string, handlers: SSEHandlers): () => void {
  const es = new EventSource(`${BACKEND_URL}/api/investigate/${id}/stream`)
  let finished = false

  const on = (type: string, cb: (data: Record<string, unknown>) => void) => {
    es.addEventListener(type, (e: Event) => {
      try { cb(JSON.parse((e as MessageEvent).data) as Record<string, unknown>) } catch { /* ignore */ }
    })
  }

  on('node_start', d => handlers.onNodeStart?.(d.node as string))
  on('tool_call', d => handlers.onToolCall?.(d.tool as string, d.args as Record<string, string>))
  on('tool_result', d => handlers.onToolResult?.(d.tool as string, d.preview as string))
  on('investigator_step', d => handlers.onInvestigatorStep?.(d.rationale as string, d.status as string))
  on('narrative', d => handlers.onNarrative?.(d.text as string, d.claim_count as number))
  on('critique', d => handlers.onCritique?.(d.flags as Flag[]))
  on('done', d => {
    finished = true
    handlers.onDone?.(d.case_file as CaseFile)
    es.close()
  })
  on('error', d => {
    finished = true
    handlers.onError?.(d.message as string)
    es.close()
  })

  // Only fire connection error if we never received a done/error event
  es.onerror = () => {
    if (!finished) { handlers.onError?.('Connection lost'); es.close() }
  }

  return () => es.close()
}

export async function getRepoTree(owner: string, repo: string, ref = 'HEAD'): Promise<string[]> {
  const res = await fetch(`${BACKEND_URL}/api/repos/${owner}/${repo}/tree?ref=${ref}`)
  if (!res.ok) throw new Error(`Failed to load tree: ${res.status}`)
  const data = await res.json() as { entries: string[] }
  return data.entries ?? []
}

export async function getFileContents(
  owner: string, repo: string, path: string, ref = 'HEAD',
): Promise<string> {
  const res = await fetch(`${BACKEND_URL}/api/repos/${owner}/${repo}/file?path=${encodeURIComponent(path)}&ref=${ref}`)
  if (!res.ok) throw new Error(`Failed to load file: ${res.status}`)
  const data = await res.json() as { content: string }
  return data.content
}
