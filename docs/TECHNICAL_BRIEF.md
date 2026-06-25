<div align="center">

```
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   G I T O N E                                         ║
║   AI-Powered Code Forensics                           ║
║                                                       ║
║   Technical Architecture & Design Brief              ║
║   Version 1.0 · June 2026                            ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
```

</div>

---

## 1. Executive Summary

GitOne is a full-stack, multi-agent AI system that answers one question developers ask dozens of times per week: **"Why does this code exist the way it does?"**

A user selects any line range in any public GitHub repository. A five-node LangGraph agent autonomously investigates the git history — running `git blame`, reading commit messages, fetching linked pull requests and GitHub issues — then synthesizes a **cited, critic-verified case file** explaining the full decision history behind those lines.

The entire investigation streams live to the browser via Server-Sent Events. Every step the agent takes appears in real time as an animated trail. The final output is not a block of text but a structured visual report: an animated SVG confidence gauge, an evidence constellation map, and verified finding cards.

---

## 2. Problem Statement

Modern codebases accumulate decisions invisibly. A function's current form may be the result of a security fix referenced in a commit that mentioned a CVE, merged via a PR that linked to an issue debated across 40 comments, then partially reverted three months later for performance reasons. This history is technically accessible — scattered across git, GitHub Issues, PRs, and comment threads — but assembling it manually takes 20–30 minutes and requires knowing what to look for.

GitOne automates this entire workflow using an agentic AI loop that follows references the way an experienced engineer would.

---

## 3. System Architecture

### 3.1 High-Level Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Next.js 14)                      │
│                                                                 │
│  Landing Page → Investigate Page → [3-pane layout]             │
│    File Tree  |  Code Viewer (Shiki)  |  Trail / Case File     │
└─────────────────────────┬───────────────────────────────────────┘
                          │  HTTP / SSE
┌─────────────────────────▼───────────────────────────────────────┐
│                       API (FastAPI 0.115)                        │
│                                                                 │
│  POST /api/investigate  →  creates investigation, returns ID    │
│  GET  /api/investigate/{id}/stream  →  SSE event stream        │
│  GET  /api/repos/{o}/{r}/tree       →  file tree               │
│  GET  /api/repos/{o}/{r}/file       →  file contents           │
└─────────────────────────┬───────────────────────────────────────┘
                          │  Python function calls
┌─────────────────────────▼───────────────────────────────────────┐
│                    AGENT (LangGraph 1.2)                         │
│                                                                 │
│  ┌─────────┐    ┌──────────────┐    ┌───────────┐             │
│  │ Investi-│◄──►│ Tool Executor│    │Synthesizer│             │
│  │  gator  │    │  (no LLM)    │    │           │             │
│  └────┬────┘    └──────────────┘    └─────┬─────┘             │
│       │                                   │                    │
│       └──────(INVESTIGATION COMPLETE)─────►    ┌──────┐       │
│                                           │    │Critic│       │
│                                           │    └──┬───┘       │
│                                           │       │           │
│                              ┌────────────┘   ┌──▼──────┐    │
│                              │                │Finalizer│    │
│                              │                └─────────┘    │
└──────────────────────────────┼──────────────────────────────┘
                               │  service calls
┌──────────────────────────────▼──────────────────────────────────┐
│                         SERVICES                                 │
│                                                                 │
│  RepoCache (LRU clone mgr)  │  GitService  │  GitHubService    │
│  asyncio.Lock per repo      │  subprocess  │  httpx async      │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Request Lifecycle

```
1.  User selects lines 946–952 in psf/requests → models.py

2.  POST /api/investigate
    ├── Validate: repo regex, path traversal check, line range ≤ 500
    ├── RepoCache.get_repo("psf/requests")
    │     ├── Lock(per-repo) acquired
    │     ├── Clone with --filter=blob:none (shallow objects)
    │     └── Return cached Path on repeat calls
    ├── GitService.get_file_contents() → read lines 946–952
    ├── make_tool_registry(git_svc, github_svc, "psf", "requests")
    ├── build_graph(tools) → compile LangGraph StateGraph
    ├── Store (initial_state, graph) under UUID "a3f8b2c9d1e0"
    └── Return {"investigation_id": "a3f8b2c9d1e0"}

3.  EventSource opens → GET /api/investigate/a3f8b2c9d1e0/stream

4.  asyncio.timeout(300) wraps graph.astream_events(state, version="v2")
    └── SSE events translated and streamed to browser

5.  Investigation completes → SSE "done" event → case_file delivered
    └── Investigation removed from memory store
```

---

## 4. The Agent System

### 4.1 LangGraph State Design

The `GraphState` TypedDict is the single source of truth shared across all five nodes. The critical design decision is the use of **Annotated reducers** on list fields:

```python
class GraphState(TypedDict):
    # Fixed inputs
    repo: str
    file_path: str
    line_start: int
    line_end: int
    selected_code: str

    # Conversation history — add_messages handles deduplication by ID
    messages: Annotated[list[BaseMessage], add_messages]

    # Accumulating evidence — operator.add APPENDS, never overwrites
    evidence: Annotated[list[Evidence], operator.add]
    log:      Annotated[list[InvestigationStep], operator.add]
    claims:   Annotated[list[Claim], operator.add]
    critique: Annotated[list[Flag], operator.add]

    # Scalar control fields
    iterations: int
    status: str        # investigating | synthesizing | critiquing | refining | done
    narrative: str
    case_file: dict
```

Without `operator.add`, each node's return dict would overwrite the list. LangGraph's reducer system allows append-only semantics, which is essential when multiple loop iterations accumulate evidence.

### 4.2 Node Specifications

#### Node 1 — Investigator

**Role:** The reasoning engine. Decides which tool to call next based on what it has found so far.

**Inputs:** Full state (code + all previous tool results)  
**LLM:** Cerebras `gpt-oss-120b` via `ChatOpenAI` (OpenAI-compatible API)  
**Tools bound:** All 9 investigation tools

**Logic:**
```
1. Build message history: SystemMessage + HumanMessage(code) + previous ToolMessages
2. Trim history if > 8 messages: keep first 2 + last 6 (evidence already in state)
3. Truncate individual ToolMessages to 800 chars
4. If iterations >= MAX_ITERATIONS (6): force status="synthesizing" without LLM call
5. Call LLM.ainvoke(messages)
6. If response has tool_calls → status="investigating" → route to ToolExecutor
7. If response has no tool_calls → status="synthesizing" → route to Synthesizer
```

**Prompt design:** The investigator is instructed to write `Rationale:` before each tool call, follow explicit references over broad keyword searches, and only call `INVESTIGATION COMPLETE` when it can cite ≥2 pieces of evidence.

#### Node 2 — Tool Executor

**Role:** Pure executor. No LLM call.

**Inputs:** Last `AIMessage` from investigator (contains tool call)  
**Outputs:** `ToolMessage` (for conversation history) + `Evidence` item (for state)

**Evidence ID scheme:**
```
git_blame          → "blame:{file}:L{start}-{end}"
get_commit         → "commit:{sha7}"
get_pull_request   → "pr:{number}"
get_issue          → "issue:{number}"
search_*           → "search:{type}:{query}"
```

These stable IDs are what the Synthesizer cites and the Critic verifies against.

#### Node 3 — Synthesizer

**Role:** Technical writer. Converts raw evidence into a structured narrative.

**Inputs:** All accumulated evidence items  
**LLM:** Cerebras `gpt-oss-120b`, `max_tokens=4096`

**Output format enforced by prompt:**
```
[3–5 paragraph narrative where every sentence cites evidence]

---CLAIMS---
```json
[
  { "id": "claim-1", "text": "...", "source_ids": ["pr:482", "issue:471"] },
  ...
]
```
```

The node parses this output by splitting on `---CLAIMS---`, extracting the JSON block via regex, and building typed `Claim` objects. No speculation — the prompt explicitly forbids it.

#### Node 4 — Critic

**Role:** Adversarial reviewer. Finds claims that overreach their cited evidence.

**Inputs:** All claims + only the evidence items they cite  
**LLM:** Cerebras `gpt-oss-120b`, `max_tokens=1024`, `temperature=0.1`

**Routing decision:**
```python
critical_flags = [f for f in flags if f["severity"] == "critical"]
refine_count = count(log entries where node == "critic")

if critical_flags and refine_count < MAX_REFINE_ITERATIONS(2):
    return "investigator"   # loop back, gather more evidence
else:
    return "finalizer"      # accept output with minor flags
```

This creates a **self-correcting pipeline**: if the synthesizer makes a claim it can't support, the critic catches it and forces the investigator to gather more evidence.

#### Node 5 — Finalizer

**Role:** Assembler. No LLM call.

**Logic:**
```python
flagged_claim_ids = {f["claim_id"] for f in critique}
claims = [{**c, "verified": c["id"] not in flagged_claim_ids} for c in claims]
evidence_map = {ev["id"]: ev for ev in evidence}  # O(1) lookup by ID
case_file = {narrative, claims, critique, evidence_map}
```

The `evidence_map` is a flat dict keyed by evidence ID — the frontend uses it to resolve citations in claim cards to full evidence objects for the slide-in panel.

---

## 5. Streaming Architecture

### 5.1 SSE Pattern

`EventSource` (the browser's native SSE API) is GET-only — it cannot send a request body. This is why GitOne uses a two-step pattern:

```
Step 1: POST /api/investigate   (sends repo, file, lines)
        ← returns investigation_id

Step 2: new EventSource(`/api/investigate/${id}/stream`)
        ← GET, no body needed, just the ID in the URL
```

### 5.2 Event Type Mapping

LangGraph's `astream_events(version="v2")` emits granular internal events. The `streaming.py` translator maps them:

```
LangGraph event                          SSE event type
─────────────────────────────────────────────────────
on_chain_start (node name)          →   node_start
on_tool_start                       →   tool_call       {tool, args}
on_tool_end                         →   tool_result     {tool, preview}
on_chain_end → investigator         →   investigator_step {rationale, status}
on_chain_end → synthesizer          →   narrative       {text, claim_count}
on_chain_end → critic               →   critique        {flags}
on_chain_end → finalizer            →   done            {case_file}
Exception / asyncio.TimeoutError    →   error           {message}
```

### 5.3 Frontend SSE Consumer

```typescript
// lib/api.ts
function streamInvestigation(id: string, handlers: SSEHandlers): () => void {
  const es = new EventSource(`${BACKEND_URL}/api/investigate/${id}/stream`)
  es.addEventListener('tool_call', e => handlers.onToolCall?.(JSON.parse(e.data)))
  es.addEventListener('done',      e => { handlers.onDone?.(JSON.parse(e.data)); es.close() })
  es.addEventListener('error',     e => { handlers.onError?.(JSON.parse(e.data).message); es.close() })
  return () => es.close()  // cleanup function
}
```

The `InvestigationTrail` component calls this and uses the cleanup in a `useEffect` return, so the stream closes if the component unmounts.

---

## 6. Frontend Architecture

### 6.1 Design System

GitOne uses a custom "Void Terminal" design system defined in `tailwind.config.ts`:

```
Background scale:
  --void    #05080F   ← deepest background
  --base    #080D1A   ← code viewer
  --surface #0C1529   ← panel background
  --panel   #0F1E38   ← raised panels

Text scale:
  --subtle  #1A2E4A
  --muted   #3B5270
  --dim     #5A7898
  --body    #8BA8C4
  --bright  #C4D8EE
  --snow    #E6F0FA

Accent colors:
  gold      #F59E0B   ← primary action, selected state
  teal      #14B8A6   ← verified, success
  violet    #8B5CF6   ← synthesis, AI actions
  crimson   #F87171   ← errors, critic flags
```

All dynamic colors (computed from data, not static) use inline `style={{ color: '#...' }}` objects because Tailwind's static analysis cannot scan computed class strings.

### 6.2 Page State Machine

The investigate page (`app/investigate/page.tsx`) implements a four-stage state machine:

```
'input'       → Repo input centered on screen
    ↓ (repo loaded)
'exploring'   → 3-pane layout: file tree | code viewer | empty right panel
    ↓ (lines selected + Investigate clicked)
'investigating' → Right panel shows live investigation trail
    ↓ (SSE "done" event)
'done'        → Right panel shows case file (tabs: Overview | Evidence | Facts)
```

### 6.3 Code Viewer — Shiki Integration

```typescript
// Module-level singleton — initialized once, reused across file loads
let _hl: Highlighter | null = null
async function getHl(): Promise<Highlighter> {
  if (!_hl) _hl = await createHighlighter({
    themes: ['github-dark-dimmed'],
    langs: Object.values(LANG_MAP)
  })
  return _hl
}

// Critical: DOMParser not regex for line extraction
const html = hl.codeToHtml(content, { lang, theme: 'github-dark-dimmed' })
const doc  = new DOMParser().parseFromString(html, 'text/html')
const els  = doc.querySelectorAll('span.line')
setLines(Array.from(els).map(el => el.innerHTML || '&nbsp;'))
```

Regex `(.*?)` is lazy — it stops at the first `</span>` inside a line (a token's closing tag), producing only the first token of each line. DOMParser handles arbitrary nesting correctly.

### 6.4 Case File — Visual Output

The `CaseFile` component renders three tabs:

**Overview Tab:**
- Animated SVG arc gauge (270° sweep, `motion.circle` animates `strokeDasharray` from `0 circumference` to `fill circumference`)
- Color-coded: teal ≥80% verified, gold ≥50%, red below
- Horizontal evidence breakdown bars (Framer Motion `width` 0→percentage)
- Top 3 verified claims as visual cards with evidence type chips

**Evidence Map Tab:**
- SVG constellation: center node + evidence nodes at positions `cx + R·cos(angle), cy + R·sin(angle)`
- `motion.path` with `pathLength: 0 → 1` draws connecting lines on mount
- Click any node → opens `EvidencePanel` slide-in
- Hover → tooltip with evidence type, ID, summary

**Facts Tab:**
- All claims with color-coded left border
- Critic flags shown inline
- Clickable evidence ID chips

---

## 7. Security Architecture

### 7.1 Input Validation

All user-controlled inputs are validated before reaching the filesystem or git:

```python
# Repo format — strict allowlist
_REPO_RE = re.compile(r'^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}/[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$')

# Path traversal prevention
def _validate_path(repo_path: Path, file_path: str) -> None:
    if ".." in file_path or file_path.startswith("/"):
        raise HTTPException(400, "Invalid file path.")
    resolved = (repo_path / file_path).resolve()
    if not str(resolved).startswith(str(repo_path.resolve())):
        raise HTTPException(400, "Invalid file path.")

# Line range cap
if request.line_end - request.line_start > 500:
    raise HTTPException(400, "Max 500 lines.")
```

### 7.2 Error Handling Strategy

Exceptions are logged server-side with full stack traces; clients receive only safe generic messages:

```python
except Exception:
    logger.exception("Clone failed for %s", request.repo)   # full trace in logs
    raise HTTPException(502, "Could not clone repository.")  # generic to client
```

### 7.3 CORS Restriction

```python
app.add_middleware(CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,   # from env, e.g. ["https://gitone.vercel.app"]
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
    allow_credentials=False,
)
```

### 7.4 SSE Timeout

```python
async with asyncio.timeout(300):  # 5-minute hard cap per investigation
    async for event in graph.astream_events(...):
        yield translate(event)
```

---

## 8. Tool Registry Pattern

Each investigation creates a fresh set of tools via a factory function that **closes over** the per-request `git_service` and `github_service` instances:

```python
def make_tool_registry(
    git_svc: GitService,
    github_svc: GitHubService,
    owner: str,
    repo: str,
) -> list[BaseTool]:
    return make_git_tools(git_svc) + make_github_tools(github_svc, owner, repo)

# Inside make_github_tools:
@tool
def get_issue(number: int) -> str:
    """Fetch a GitHub issue by number."""
    # `github_svc`, `owner`, `repo` captured from outer scope
    return asyncio.run(github_svc.get_issue(owner, repo, number))
```

This means the LLM only needs to call `get_issue(number=482)` — it never sees or handles the repo context. The closure provides it implicitly and safely per-investigation.

---

## 9. Git Blame Parser

GitPython's blame API is unreliable for large ranges. GitOne calls `git blame --porcelain` via `subprocess.run` and parses the output with a custom state machine:

```
Porcelain output format:
  <40-char SHA> <orig-line> <result-line> [<num-lines>]   ← commit header
  author <name>
  author-mail <email>
  author-time <unix timestamp>
  ... more metadata ...
  \t<actual code line>                                     ← content line

Parser state:
  - Line matching /^[a-f0-9]{40} / → new commit header, extract SHA + line num
  - Lines "author ", "author-mail ", "author-time " → metadata
  - Lines starting with \t → code content, emit BlameEntry, reset current dict
```

This gives per-line author, commit SHA, and timestamp in a single subprocess call.

---

## 10. Deployment

### Target Infrastructure

| Component | Platform | Notes |
|---|---|---|
| Backend | Railway | Procfile: `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Frontend | Vercel | `NEXT_PUBLIC_BACKEND_URL` env var points to Railway URL |
| Repo cache | Railway ephemeral disk | Re-clones on restart; acceptable for MVP |

### Environment Variables

**Backend (Railway)**
```
CEREBRAS_API_KEY=csk-...
GITHUB_TOKEN=github_pat_...
CORS_ORIGINS=["https://your-app.vercel.app"]
REPO_CACHE_DIR=/tmp/gitone_repos
MAX_ITERATIONS=6
MAX_REFINE_ITERATIONS=2
```

**Frontend (Vercel)**
```
NEXT_PUBLIC_BACKEND_URL=https://your-backend.railway.app
```

---

## 11. Performance Characteristics

| Operation | Typical Duration | Notes |
|---|---|---|
| Repo clone (first load) | 10–40 s | Depends on repo size; `--filter=blob:none` helps |
| Repo cache hit | < 1 s | asyncio.Lock prevents double-clone |
| git blame (10 lines) | < 500 ms | subprocess, no network |
| GitHub API call | 200–800 ms | httpx with 30s timeout |
| LLM call (investigator) | 500–2000 ms | Cerebras fast inference |
| Full investigation (6 tools) | 15–45 s | Streams live, so user sees progress |
| Synthesizer | 3–8 s | 4096 token output |
| Critic | 1–3 s | 1024 token output |

---

## 12. Known Limitations and Future Work

**Current limitations:**
- Private repos are not supported (no user-level GitHub OAuth)
- In-memory investigation store — doesn't survive backend restarts
- Single-worker deployment — investigation store not shared across workers
- No user accounts or investigation history

**Possible extensions:**
- Private repo support via GitHub OAuth
- Redis-backed investigation store for multi-worker deployments
- Persistent case file history per user
- Diff-mode: investigate what changed between two commits
- VS Code extension that shows case files inline
- Webhook trigger: auto-investigate PRs before merge

---

<div align="center">

*Built with FastAPI · LangGraph · Cerebras · Next.js · Framer Motion*

*Richang Chaudhary · 2026*

</div>
