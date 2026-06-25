'use client'
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { streamInvestigation } from '@/lib/api'
import type { CaseFile, TrailStep } from '@/lib/types'
import TrailNode from './TrailNode'

interface Props {
  investigationId: string | null
  onCaseFile: (cf: CaseFile) => void
}

export default function InvestigationTrail({ investigationId, onCaseFile }: Props) {
  const [steps, setSteps] = useState<TrailStep[]>([])
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const startRef = useRef(0)

  const push = (step: Omit<TrailStep, 'isActive' | 'timestamp'>) =>
    setSteps(prev => [
      ...prev.map(s => ({ ...s, isActive: false })),
      { ...step, isActive: true, timestamp: Date.now() },
    ])

  useEffect(() => {
    if (status !== 'running') return
    startRef.current = Date.now()
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 500)
    return () => clearInterval(id)
  }, [status])

  useEffect(() => {
    if (!investigationId) return
    setSteps([]); setStatus('running'); setErrorMsg(''); setElapsed(0)

    const cleanup = streamInvestigation(investigationId, {
      onNodeStart: node => {
        if (node === 'synthesizer') push({ type: 'synthesis', label: 'Synthesizing case file…' })
        else if (node === 'critic') push({ type: 'critic', label: 'Verifying claims…' })
      },
      onToolCall: (tool, args) => {
        push({ type: 'tool', label: tool.replace(/_/g, ' '), detail: Object.values(args).join(', ').slice(0, 80) })
      },
      onToolResult: (tool, preview) => {
        push({ type: 'evidence', label: `${tool.replace(/_/g, ' ')} →`, detail: preview.slice(0, 90) })
      },
      onInvestigatorStep: rationale => {
        if (rationale) setSteps(prev =>
          prev.map((s, i) => i === prev.length - 1 ? { ...s, detail: rationale.slice(0, 90) } : s)
        )
      },
      onNarrative: (text, claimCount) => {
        push({ type: 'synthesis', label: `${claimCount} claims ready`, detail: text.slice(0, 80) })
      },
      onCritique: flags => {
        if (flags.length > 0) push({ type: 'critic', label: `${flags.length} flag${flags.length > 1 ? 's' : ''} found` })
      },
      onDone: cf => {
        setStatus('done')
        setSteps(prev => prev.map(s => ({ ...s, isActive: false })))
        onCaseFile(cf)
      },
      onError: msg => {
        setStatus(s => s === 'done' ? 'done' : 'error')
        setErrorMsg(msg)
      },
    })
    return cleanup
  }, [investigationId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [steps.length])

  /* ── Idle ───────────────────────────── */
  if (status === 'idle') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="w-14 h-14 rounded-2xl border border-line flex items-center justify-center text-2xl animate-float shadow-float"
          style={{ background: 'rgba(15,30,56,0.8)' }}>
          🔍
        </div>
        <div>
          <p className="font-display font-semibold text-bright/60 text-[14px] mb-1">Ready to investigate</p>
          <p className="text-[12px] text-dim font-body leading-relaxed max-w-48">
            Select lines in the code viewer,<br />
            then click <span className="text-gold font-semibold">Investigate</span>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Status bar */}
      <div className="px-4 py-2.5 border-b flex items-center gap-2.5 flex-shrink-0"
        style={{ borderColor: 'rgba(26,46,74,0.6)', background: 'rgba(9,15,28,0.8)' }}>
        {status === 'running' && (
          <>
            <motion.div className="w-2 h-2 rounded-full bg-gold flex-shrink-0"
              animate={{ opacity: [1, 0.2, 1] }} transition={{ repeat: Infinity, duration: 1 }} />
            <span className="text-[11px] font-mono text-gold">Investigating…</span>
            <span className="ml-auto text-[10px] font-mono text-muted">{elapsed}s</span>
          </>
        )}
        {status === 'done' && (
          <>
            <div className="w-2 h-2 rounded-full bg-teal flex-shrink-0" />
            <span className="text-[11px] font-mono text-teal">Complete</span>
            <span className="ml-auto text-[10px] font-mono text-muted">{elapsed}s</span>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="w-2 h-2 rounded-full bg-crimson flex-shrink-0" />
            <span className="text-[11px] font-mono text-crimson">Error</span>
          </>
        )}
      </div>

      {/* Steps */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <AnimatePresence>
          {steps.map((step, i) => (
            <TrailNode key={i} step={step} isActive={step.isActive} index={i} />
          ))}
        </AnimatePresence>
        {status === 'error' && errorMsg && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="mt-2 p-3 rounded-xl text-[11px] font-mono border"
            style={{ background: 'rgba(248,113,113,0.06)', borderColor: 'rgba(248,113,113,0.2)', color: 'rgba(248,113,113,0.8)' }}>
            {errorMsg}
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Footer */}
      {steps.length > 0 && (
        <div className="px-4 py-2 border-t flex-shrink-0"
          style={{ borderColor: 'rgba(26,46,74,0.4)' }}>
          <p className="text-[9.5px] font-mono text-muted">
            {steps.length} steps · {steps.filter(s => s.type === 'evidence').length} evidence found
          </p>
        </div>
      )}
    </div>
  )
}
