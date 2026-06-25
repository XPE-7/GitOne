'use client'
import { useEffect } from 'react'
import { motion } from 'framer-motion'
import type { Evidence } from '@/lib/types'

interface Props { evidence: Evidence | null; onClose: () => void }

function str(v: unknown) { return v == null ? '' : String(v) }
function has(c: Record<string, unknown>, k: string) { return Boolean(c[k]) }

const TYPE_META: Record<string, { icon: string; label: string; color: string }> = {
  commit: { icon: '📦', label: 'Commit',   color: '#F59E0B' },
  blame:  { icon: '👤', label: 'Blame',    color: '#8BA8C4' },
  pr:     { icon: '🔀', label: 'Pull Request', color: '#14B8A6' },
  issue:  { icon: '🐛', label: 'Issue',    color: '#F87171' },
  search: { icon: '🔍', label: 'Search',   color: '#8BA8C4' },
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[9px] font-mono uppercase tracking-[0.18em]" style={{ color: '#3B5270' }}>{label}</p>
      <div>{children}</div>
    </div>
  )
}

function Content({ ev }: { ev: Evidence }) {
  const c = ev.content
  if (ev.type === 'commit') return (
    <div className="space-y-4">
      {has(c, 'message') && <Field label="Commit message"><p className="font-mono text-[12px] leading-relaxed whitespace-pre-wrap" style={{ color: '#C4D8EE' }}>{str(c.message)}</p></Field>}
      {has(c, 'author')  && <Field label="Author"><p className="text-[12px]" style={{ color: '#8BA8C4' }}>{str(c.author)}</p></Field>}
      {has(c, 'date')    && <Field label="Date"><p className="font-mono text-[12px]" style={{ color: '#8BA8C4' }}>{str(c.date)}</p></Field>}
      {has(c, 'files_changed') && (
        <Field label="Stats">
          <p className="font-mono text-[11px]" style={{ color: '#8BA8C4' }}>
            {str(c.files_changed)} files · <span style={{ color: '#14B8A6' }}>+{str(c.insertions)}</span> <span style={{ color: '#F87171' }}>-{str(c.deletions)}</span>
          </p>
        </Field>
      )}
    </div>
  )

  if (ev.type === 'blame') return (
    <div className="space-y-4">
      {has(c, 'blame_entries') && (
        <Field label={`${(c.blame_entries as unknown[]).length} blamed lines`}>
          <p className="text-[12px]" style={{ color: '#8BA8C4' }}>Across {new Set((c.blame_entries as Array<{ author: string }>).map(e => e.author)).size} author(s)</p>
        </Field>
      )}
    </div>
  )

  if (ev.type === 'pr' || ev.type === 'issue') return (
    <div className="space-y-4">
      {has(c, 'title') && <Field label="Title"><p className="font-body text-[13px] font-semibold leading-snug" style={{ color: '#E6F0FA' }}>{str(c.title)}</p></Field>}
      {has(c, 'state') && (
        <Field label="State">
          <span className="text-[11px] px-2 py-0.5 rounded font-mono"
            style={{
              background: str(c.state) === 'open' ? 'rgba(20,184,166,0.15)' : 'rgba(90,120,152,0.15)',
              color: str(c.state) === 'open' ? '#14B8A6' : '#5A7898',
              border: `1px solid ${str(c.state) === 'open' ? 'rgba(20,184,166,0.3)' : 'rgba(90,120,152,0.25)'}`,
            }}>
            {str(c.state)}
          </span>
        </Field>
      )}
      {has(c, 'body') && str(c.body).length > 10 && (
        <Field label="Body">
          <p className="text-[11.5px] font-body leading-relaxed whitespace-pre-wrap line-clamp-12" style={{ color: '#8BA8C4' }}>
            {str(c.body).slice(0, 1200)}
          </p>
        </Field>
      )}
    </div>
  )

  return <pre className="text-[11px] font-mono whitespace-pre-wrap overflow-auto" style={{ color: '#5A7898' }}>{JSON.stringify(c, null, 2).slice(0, 2000)}</pre>
}

export default function EvidencePanel({ evidence, onClose }: Props) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  if (!evidence) return null
  const meta = TYPE_META[evidence.type] ?? TYPE_META.search

  return (
    <>
      {/* Backdrop */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 cursor-pointer"
        style={{ background: 'rgba(5,8,15,0.7)', backdropFilter: 'blur(4px)' }}
        onClick={onClose} />

      {/* Panel */}
      <motion.div
        initial={{ x: '100%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '100%', opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="fixed right-0 top-0 h-full w-[400px] z-50 flex flex-col"
        style={{ background: '#08101E', borderLeft: '1px solid rgba(26,46,74,0.8)' }}
      >
        {/* Header */}
        <div className="px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(26,46,74,0.6)' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                style={{ background: `${meta.color}12`, border: `1px solid ${meta.color}28` }}>
                {meta.icon}
              </div>
              <div>
                <p className="text-[9px] font-mono uppercase tracking-[0.18em] mb-0.5" style={{ color: meta.color }}>{meta.label}</p>
                <p className="font-mono text-[12px]" style={{ color: '#C4D8EE' }}>{evidence.id}</p>
              </div>
            </div>
            <button onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-lg leading-none transition-all flex-shrink-0"
              style={{ color: '#3B5270', background: 'rgba(26,46,74,0.5)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#C4D8EE' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#3B5270' }}
            >×</button>
          </div>
        </div>

        {/* Summary */}
        <div className="px-5 py-3 flex-shrink-0" style={{ background: 'rgba(15,30,56,0.5)', borderBottom: '1px solid rgba(26,46,74,0.5)' }}>
          <p className="text-[12px] font-body leading-relaxed" style={{ color: '#8BA8C4' }}>{evidence.summary}</p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <Content ev={evidence} />
        </div>
      </motion.div>
    </>
  )
}
