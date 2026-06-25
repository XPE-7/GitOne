'use client'
import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { investigate, getRepoTree, getFileContents } from '@/lib/api'
import type { CaseFile } from '@/lib/types'
import RepoInput from '@/components/RepoInput'
import FileTree from '@/components/FileTree'
import CodeViewer from '@/components/CodeViewer'
import InvestigationTrail from '@/components/InvestigationTrail'
import CaseFileComp from '@/components/CaseFile'

type Stage = 'input' | 'exploring' | 'investigating' | 'done'

export default function InvestigatePage() {
  const [stage, setStage]               = useState<Stage>('input')
  const [repo, setRepo]                 = useState('')
  const [treeEntries, setTreeEntries]   = useState<string[]>([])
  const [activeFile, setActiveFile]     = useState('')
  const [fileContent, setFileContent]   = useState('')
  const [lineStart, setLineStart]       = useState(0)
  const [lineEnd, setLineEnd]           = useState(0)
  const [loadingRepo, setLoadingRepo]   = useState(false)
  const [loadingFile, setLoadingFile]   = useState(false)
  const [investigationId, setInvestigationId] = useState<string | null>(null)
  const [caseFile, setCaseFile]         = useState<CaseFile | null>(null)
  const [error, setError]               = useState('')

  const handleRepoSubmit = useCallback(async (r: string) => {
    setLoadingRepo(true); setError('')
    try {
      const [o, n] = r.split('/')
      const entries = await getRepoTree(o, n)
      setRepo(r); setTreeEntries(entries); setStage('exploring')
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load repository') }
    finally { setLoadingRepo(false) }
  }, [])

  const handleFileSelect = useCallback(async (path: string) => {
    setLoadingFile(true); setActiveFile(path); setLineStart(0); setLineEnd(0); setError('')
    try {
      const [o, n] = repo.split('/')
      setFileContent(await getFileContents(o, n, path))
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load file') }
    finally { setLoadingFile(false) }
  }, [repo])

  const handleSelect = useCallback((s: number, e: number) => { setLineStart(s); setLineEnd(e) }, [])

  const handleInvestigate = useCallback(async () => {
    if (!lineStart || !lineEnd) return
    setError('')
    try {
      const id = await investigate({ repo, file_path: activeFile, line_start: lineStart, line_end: lineEnd })
      setInvestigationId(id); setCaseFile(null); setStage('investigating')
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to start investigation') }
  }, [repo, activeFile, lineStart, lineEnd])

  const hasSelection = lineStart > 0 && lineEnd > 0
  const selCount = hasSelection ? lineEnd - lineStart + 1 : 0

  return (
    <div className="h-screen bg-base text-bright flex flex-col overflow-hidden" style={{ fontFamily: 'var(--font-body)' }}>

      {/* ── Top bar ──────────────────────────────────── */}
      <div className="h-[46px] flex-shrink-0 flex items-center px-4 gap-3 border-b border-line/70"
        style={{ background: 'rgba(8,13,26,0.95)', backdropFilter: 'blur(12px)' }}>

        {/* Logo */}
        <a href="/" className="flex items-center gap-2 flex-shrink-0 group">
          <div className="w-6 h-6 rounded-md border border-gold/30 flex items-center justify-center transition-all group-hover:border-gold/60"
            style={{ background: 'rgba(245,158,11,0.08)' }}>
            <svg width="11" height="11" viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="20" r="17" stroke="#F59E0B" strokeWidth="2.5"/>
              <circle cx="20" cy="13" r="3.5" fill="#F59E0B"/>
              <path d="M20 17v11" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="13" cy="30" r="3" stroke="#C4D8EE" strokeWidth="1.5"/>
              <circle cx="27" cy="30" r="3" stroke="#C4D8EE" strokeWidth="1.5"/>
            </svg>
          </div>
          <span className="font-display font-bold text-snow text-[13px] tracking-tight">GitOne</span>
        </a>

        {/* Divider */}
        <div className="h-4 w-px bg-line flex-shrink-0" />

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-[11.5px] font-mono min-w-0 flex-1">
          {repo ? (
            <>
              <span className="text-dim truncate max-w-32">{repo}</span>
              {activeFile && (
                <>
                  <span className="text-muted/50">/</span>
                  <span className="text-body/70 truncate">{activeFile.split('/').pop()}</span>
                </>
              )}
              {hasSelection && (
                <span className="ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono text-gold bg-gold/10 border border-gold/20 flex-shrink-0">
                  L{lineStart}–{lineEnd}
                </span>
              )}
            </>
          ) : (
            <span className="text-muted">No repository loaded</span>
          )}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {error && (
            <span className="text-[11px] font-mono text-crimson/80 max-w-40 truncate">{error}</span>
          )}

          <AnimatePresence>
            {stage === 'done' && (
              <motion.button
                initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                onClick={() => { setCaseFile(null); setInvestigationId(null); setStage('exploring'); setLineStart(0); setLineEnd(0) }}
                className="text-[11px] font-mono text-dim hover:text-bright transition-colors px-3 py-1.5 rounded-lg hover:bg-panel border border-transparent hover:border-line">
                ← New investigation
              </motion.button>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {hasSelection && (stage === 'exploring') && (
              <motion.button
                key="investigate"
                initial={{ opacity: 0, scale: 0.88, x: 10 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.88, x: 10 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                onClick={handleInvestigate}
                className="flex items-center gap-2 px-4 py-2 bg-gold text-base font-display font-bold text-[12px] rounded-lg hover:brightness-105 transition-all shadow-gold-sm"
              >
                <span>🔍</span>
                <span>Investigate</span>
                <span className="opacity-60 font-mono font-normal text-[10px]">{selCount}L</span>
              </motion.button>
            )}
            {stage === 'investigating' && (
              <motion.div
                key="running"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-panel border border-line text-[11px] font-mono text-body">
                <motion.div
                  className="w-1.5 h-1.5 rounded-full bg-gold flex-shrink-0"
                  animate={{ opacity: [1, 0.2, 1] }} transition={{ repeat: Infinity, duration: 1 }} />
                Investigating…
              </motion.div>
            )}
            {stage === 'done' && caseFile && (
              <motion.div
                key="done"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-mono text-teal">
                <div className="w-1.5 h-1.5 rounded-full bg-teal flex-shrink-0" />
                Complete
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex overflow-hidden">

        {/* ── Input stage ──────────────────────────── */}
        <AnimatePresence mode="wait">
          {stage === 'input' && (
            <motion.div key="input"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center gap-8 px-6 relative dot-grid">
              <div className="absolute inset-0 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at center, rgba(245,158,11,0.06) 0%, transparent 60%)' }} />
              <div className="relative text-center max-w-lg">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="text-5xl mb-6 animate-float inline-block">🔬</div>
                  <h1 className="font-display font-black text-snow text-3xl md:text-4xl mb-3 tracking-tight">
                    Open a <span className="text-glow">repository</span>
                  </h1>
                  <p className="text-body font-body text-[14px] mb-8 leading-relaxed">
                    Paste a GitHub URL or type <span className="font-mono text-gold/80 bg-gold/8 px-1.5 rounded">owner/repo</span> to load the file tree
                  </p>
                  <RepoInput onSubmit={handleRepoSubmit} loading={loadingRepo} />
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Three-pane IDE layout ─────────────────── */}
        {(stage === 'exploring' || stage === 'investigating' || stage === 'done') && (
          <>
            {/* File Explorer */}
            <div className="w-[220px] flex-shrink-0 flex flex-col min-h-0 border-r border-line/70"
              style={{ background: 'rgba(8,13,26,0.95)' }}>
              <div className="h-9 flex items-center justify-between px-3 border-b border-line/50 flex-shrink-0">
                <span className="text-[9px] uppercase tracking-[0.15em] font-mono text-muted">Explorer</span>
                <span className="text-[9px] font-mono text-muted/60">{treeEntries.length}</span>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                <FileTree entries={treeEntries} activeFile={activeFile} onSelect={handleFileSelect} />
              </div>
            </div>

            {/* Code Viewer */}
            <div className="flex-1 min-w-0 min-h-0 flex flex-col border-r border-line/70 bg-base">
              {/* Tab bar */}
              <div className="h-9 flex items-center border-b border-line/50 flex-shrink-0 bg-surface/50">
                {activeFile ? (
                  <div className="flex items-center gap-2 px-4 h-full border-r border-line/50 bg-panel/60">
                    <span className="text-[11px] font-mono text-body/70 truncate max-w-52">{activeFile.split('/').pop()}</span>
                    {hasSelection && (
                      <span className="text-[9px] font-mono text-gold bg-gold/10 border border-gold/20 px-1.5 py-0.5 rounded-md flex-shrink-0">
                        L{lineStart}–{lineEnd}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="px-4 text-[11px] font-mono text-muted">No file selected</span>
                )}
              </div>

              {/* Content area */}
              {loadingFile ? (
                <div className="flex-1 min-h-0 p-5 space-y-2 overflow-hidden">
                  {Array.from({ length: 24 }, (_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <div className="skel w-8 h-2.5 flex-shrink-0 opacity-40" />
                      <div className="skel h-2.5" style={{ width: `${20 + (i * 37 % 65)}%` }} />
                    </div>
                  ))}
                </div>
              ) : fileContent ? (
                <CodeViewer
                  content={fileContent} filePath={activeFile}
                  lineStart={lineStart} lineEnd={lineEnd}
                  onSelect={handleSelect}
                />
              ) : (
                <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-5 text-center px-8">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl bg-panel border border-line flex items-center justify-center text-3xl animate-float shadow-float">
                      📂
                    </div>
                    <motion.div
                      animate={{ x: [-4, 4, -4] }} transition={{ repeat: Infinity, duration: 1.8 }}
                      className="absolute -bottom-2 -right-2 w-6 h-6 rounded-full bg-gold border-2 border-base flex items-center justify-center text-base text-[10px] font-bold shadow-gold-sm">
                      ←
                    </motion.div>
                  </div>
                  <div>
                    <p className="font-display font-semibold text-bright/60 text-[15px] mb-1">Pick a file</p>
                    <p className="text-[12px] text-dim font-body leading-relaxed max-w-44">
                      Browse the explorer on the left, then drag to select lines
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Right panel */}
            <div className="w-[350px] flex-shrink-0 flex flex-col min-h-0"
              style={{ background: 'rgba(9,15,28,0.97)' }}>
              <div className="h-9 flex items-center px-3 border-b border-line/50 flex-shrink-0">
                <AnimatePresence mode="wait">
                  {caseFile ? (
                    <motion.div key="cf-header" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="flex items-center justify-between w-full">
                      <span className="text-[9px] uppercase tracking-[0.15em] font-mono text-muted">Case File</span>
                      <span className="flex items-center gap-1.5 text-[9px] font-mono text-teal">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal" />
                        Complete
                      </span>
                    </motion.div>
                  ) : (
                    <motion.div key="trail-header" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="flex items-center justify-between w-full">
                      <span className="text-[9px] uppercase tracking-[0.15em] font-mono text-muted">
                        {stage === 'investigating' ? 'Live Trail' : 'Investigation'}
                      </span>
                      {stage === 'investigating' && (
                        <motion.div className="w-1.5 h-1.5 rounded-full bg-gold"
                          animate={{ opacity: [1, 0.2, 1] }} transition={{ repeat: Infinity, duration: 1 }} />
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <AnimatePresence mode="wait">
                  {caseFile ? (
                    <CaseFileComp key="cf" caseFile={caseFile} repo={repo} filePath={activeFile} />
                  ) : (
                    <InvestigationTrail key="trail" investigationId={investigationId}
                      onCaseFile={cf => { setCaseFile(cf); setStage('done') }} />
                  )}
                </AnimatePresence>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
