'use client'
import { useState, useMemo, useRef } from 'react'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import type { CaseFile as CaseFileType, Evidence } from '@/lib/types'
import EvidencePanel from './EvidencePanel'

interface Props { caseFile: CaseFileType; repo: string; filePath: string }

/* ── helpers ─────────────────────────────────────── */
function clean(s: string) {
  return s.replace(/【[^】]*】/g, '').replace(/\[[\w:./\-#]+\]/g, '').trim()
}

const EV_CFG: Record<string, { color: string; glow: string; icon: string; label: string }> = {
  commit: { color: '#F59E0B', glow: 'rgba(245,158,11,0.35)', icon: '📦', label: 'Commit' },
  blame:  { color: '#8BA8C4', glow: 'rgba(139,168,196,0.25)', icon: '👤', label: 'Blame'  },
  pr:     { color: '#14B8A6', glow: 'rgba(20,184,166,0.35)',  icon: '🔀', label: 'PR'     },
  issue:  { color: '#F87171', glow: 'rgba(248,113,113,0.3)',  icon: '🐛', label: 'Issue'  },
  search: { color: '#8B5CF6', glow: 'rgba(139,92,246,0.3)',   icon: '🔍', label: 'Search' },
}
const EV_DEF = { color: '#5A7898', glow: 'rgba(90,120,152,0.2)', icon: '📄', label: 'Source' }

/* ── Inline highlight ────────────────────────────── */
function Hl({ text }: { text: string }) {
  const parts = clean(text).split(/(\b[0-9a-f]{7,8}\b|#\d{1,6}|"[^"]{2,60}")/g)
  return (
    <>
      {parts.map((p, i) => {
        if (/^[0-9a-f]{7,8}$/.test(p))
          return <code key={i} style={{ color: '#F59E0B', background: 'rgba(245,158,11,0.1)', padding: '0 4px', borderRadius: 4, fontSize: 10 }} className="font-mono">{p}</code>
        if (/^#\d/.test(p))
          return <span key={i} style={{ color: '#14B8A6' }} className="font-mono text-[11px]">{p}</span>
        if (p.startsWith('"'))
          return <em key={i} style={{ color: '#FCD34D' }} className="not-italic font-medium">{p}</em>
        return <span key={i}>{p}</span>
      })}
    </>
  )
}

/* ══════════════════════════════════════════════════
   1. CONFIDENCE GAUGE  (animated SVG arc)
══════════════════════════════════════════════════ */
function ConfidenceGauge({ verified, total }: { verified: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((verified / total) * 100)
  const R = 38, STROKE = 7
  const circ = 2 * Math.PI * R
  const arcLen = circ * 0.75          // 270° sweep
  const fill = (pct / 100) * arcLen
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })

  const color = pct >= 80 ? '#14B8A6' : pct >= 50 ? '#F59E0B' : '#F87171'

  return (
    <div ref={ref} className="relative flex items-center justify-center" style={{ width: 96, height: 96 }}>
      <svg width={96} height={96} viewBox="0 0 96 96">
        {/* Track */}
        <circle cx={48} cy={48} r={R} fill="none"
          stroke="rgba(26,46,74,0.9)" strokeWidth={STROKE}
          strokeDasharray={`${arcLen} ${circ}`} strokeLinecap="round"
          transform="rotate(135 48 48)" />
        {/* Score arc */}
        <motion.circle cx={48} cy={48} r={R} fill="none"
          stroke={color} strokeWidth={STROKE}
          strokeDasharray={`${inView ? fill : 0} ${circ}`}
          strokeLinecap="round"
          transform="rotate(135 48 48)"
          initial={{ strokeDasharray: `0 ${circ}` }}
          animate={{ strokeDasharray: inView ? `${fill} ${circ}` : `0 ${circ}` }}
          transition={{ duration: 1.4, delay: 0.2, ease: [0.34, 1.1, 0.64, 1] }}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
        {/* Dot at end of arc */}
        {inView && pct > 0 && (
          <motion.circle r={3.5} fill={color}
            cx={48 + R * Math.cos((135 + 270 * pct / 100) * Math.PI / 180)}
            cy={48 + R * Math.sin((135 + 270 * pct / 100) * Math.PI / 180)}
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ delay: 1.5, type: 'spring', stiffness: 400 }}
            style={{ filter: `drop-shadow(0 0 4px ${color})` }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.p initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.8 }}
          className="font-display font-black text-xl leading-none" style={{ color }}>
          {pct}%
        </motion.p>
        <p className="text-[8.5px] font-mono mt-0.5" style={{ color: '#3B5270' }}>verified</p>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════
   2. EVIDENCE TYPE BREAKDOWN BARS
══════════════════════════════════════════════════ */
function EvidenceBars({ evMap }: { evMap: Record<string, Evidence> }) {
  const counts = useMemo(() => {
    const acc: Record<string, number> = {}
    Object.values(evMap).forEach(e => { acc[e.type] = (acc[e.type] ?? 0) + 1 })
    return Object.entries(acc).sort((a, b) => b[1] - a[1])
  }, [evMap])
  const max = Math.max(...counts.map(c => c[1]), 1)
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })

  return (
    <div ref={ref} className="space-y-2">
      {counts.map(([type, n], i) => {
        const cfg = EV_CFG[type] ?? EV_DEF
        return (
          <div key={type} className="flex items-center gap-2.5">
            <span className="text-[11px] w-4 flex-shrink-0">{cfg.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(26,46,74,0.7)' }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: cfg.color, boxShadow: `0 0 8px ${cfg.glow}` }}
                  initial={{ width: 0 }}
                  animate={inView ? { width: `${(n / max) * 100}%` } : { width: 0 }}
                  transition={{ duration: 0.8, delay: 0.3 + i * 0.1, ease: [0.34, 1.1, 0.64, 1] }}
                />
              </div>
            </div>
            <span className="text-[10px] font-mono w-12 text-right flex-shrink-0" style={{ color: cfg.color }}>
              {cfg.label} ×{n}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/* ══════════════════════════════════════════════════
   3. EVIDENCE CONSTELLATION  (SVG node graph)
══════════════════════════════════════════════════ */
function EvidenceConstellation({ evMap, onSelect }: { evMap: Record<string, Evidence>; onSelect: (e: Evidence) => void }) {
  const evs = Object.values(evMap).slice(0, 9)
  const W = 300, H = 230
  const cx = W / 2, cy = H / 2 - 10
  const R = 82
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  const [hovered, setHovered] = useState<string | null>(null)

  return (
    <div ref={ref} className="relative" style={{ width: '100%', height: H }}>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <defs>
          {Object.entries(EV_CFG).map(([k, v]) => (
            <radialGradient key={k} id={`grd-${k}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={v.color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={v.color} stopOpacity="0" />
            </radialGradient>
          ))}
        </defs>

        {/* Connecting paths */}
        {evs.map((ev, i) => {
          const angle = (i / evs.length) * 2 * Math.PI - Math.PI / 2
          const x = cx + R * Math.cos(angle)
          const y = cy + R * Math.sin(angle)
          const cfg = EV_CFG[ev.type] ?? EV_DEF
          const isHov = hovered === ev.id
          return (
            <motion.path key={`line-${ev.id}`}
              d={`M${cx},${cy} Q${(cx + x) / 2 + (Math.random() - 0.5) * 20},${(cy + y) / 2 + (Math.random() - 0.5) * 20} ${x},${y}`}
              fill="none" stroke={cfg.color}
              strokeWidth={isHov ? 1.5 : 0.8}
              strokeDasharray="4 3"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={inView ? { pathLength: 1, opacity: isHov ? 0.7 : 0.25 } : { pathLength: 0, opacity: 0 }}
              transition={{ duration: 0.9, delay: 0.3 + i * 0.07 }}
            />
          )
        })}

        {/* Centre glow */}
        <motion.circle cx={cx} cy={cy} r={28}
          fill={`url(#grd-commit)`} stroke="none"
          initial={{ scale: 0 }} animate={inView ? { scale: 1 } : { scale: 0 }}
          transition={{ duration: 0.6, type: 'spring' }} />
        {/* Centre circle */}
        <motion.circle cx={cx} cy={cy} r={18}
          fill="rgba(245,158,11,0.12)" stroke="#F59E0B" strokeWidth={1.5}
          initial={{ scale: 0 }} animate={inView ? { scale: 1 } : { scale: 0 }}
          transition={{ duration: 0.5, delay: 0.1, type: 'spring', stiffness: 350 }}
          style={{ filter: 'drop-shadow(0 0 8px rgba(245,158,11,0.5))' }}
        />
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize="13">🔍</text>

        {/* Evidence nodes */}
        {evs.map((ev, i) => {
          const angle = (i / evs.length) * 2 * Math.PI - Math.PI / 2
          const x = cx + R * Math.cos(angle)
          const y = cy + R * Math.sin(angle)
          const cfg = EV_CFG[ev.type] ?? EV_DEF
          const isHov = hovered === ev.id
          return (
            <g key={ev.id}
              onMouseEnter={() => setHovered(ev.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onSelect(ev)}
              style={{ cursor: 'pointer' }}>
              {/* Outer glow */}
              <motion.circle cx={x} cy={y} r={22}
                fill={`url(#grd-${ev.type})`} stroke="none"
                initial={{ scale: 0, opacity: 0 }}
                animate={inView ? { scale: isHov ? 1.3 : 1, opacity: 1 } : { scale: 0, opacity: 0 }}
                transition={{ duration: 0.4, delay: 0.4 + i * 0.07 }}
              />
              {/* Node circle */}
              <motion.circle cx={x} cy={y} r={14}
                fill={isHov ? `${cfg.color}28` : `${cfg.color}14`}
                stroke={cfg.color} strokeWidth={isHov ? 2 : 1.5}
                initial={{ scale: 0, opacity: 0 }}
                animate={inView ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
                transition={{ duration: 0.4, delay: 0.4 + i * 0.07, type: 'spring', stiffness: 300 }}
                style={{ filter: isHov ? `drop-shadow(0 0 6px ${cfg.color})` : 'none' }}
              />
              <text x={x} y={y + 4.5} textAnchor="middle" fontSize="11">{cfg.icon}</text>
            </g>
          )
        })}
      </svg>

      {/* Tooltip on hover */}
      <AnimatePresence>
        {hovered && (() => {
          const ev = evMap[hovered]
          if (!ev) return null
          const cfg = EV_CFG[ev.type] ?? EV_DEF
          return (
            <motion.div
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-2 rounded-xl text-center pointer-events-none"
              style={{ background: 'rgba(8,13,26,0.95)', border: `1px solid ${cfg.color}35`, minWidth: 140 }}>
              <p className="text-[9px] font-mono uppercase tracking-widest mb-0.5" style={{ color: cfg.color }}>{cfg.label}</p>
              <p className="text-[11px] font-mono" style={{ color: '#C4D8EE' }}>{ev.id}</p>
              <p className="text-[10px] font-body mt-0.5 line-clamp-1" style={{ color: '#5A7898' }}>{ev.summary}</p>
            </motion.div>
          )
        })()}
      </AnimatePresence>
    </div>
  )
}

/* ══════════════════════════════════════════════════
   4. TOP FINDING CARDS  (from verified claims)
══════════════════════════════════════════════════ */
function FindingCards({ claims, evMap, onClick }: {
  claims: CaseFileType['claims']; evMap: Record<string, Evidence>
  onClick: (e: Evidence) => void
}) {
  // Show top 3 verified claims first, then unverified
  const sorted = [...claims].sort((a, b) => (b.verified ? 1 : 0) - (a.verified ? 1 : 0)).slice(0, 3)
  if (!sorted.length) return null

  const CARD_ACCENTS = [
    { bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.22)', num: '#F59E0B' },
    { bg: 'rgba(20,184,166,0.07)', border: 'rgba(20,184,166,0.22)', num: '#14B8A6' },
    { bg: 'rgba(139,92,246,0.07)', border: 'rgba(139,92,246,0.22)', num: '#8B5CF6' },
  ]

  return (
    <div className="space-y-2.5">
      {sorted.map((c, i) => {
        const acc = CARD_ACCENTS[i % CARD_ACCENTS.length]
        const evTypes = [...new Set(c.source_ids.map(id => evMap[id]?.type).filter(Boolean))]
        return (
          <motion.div key={c.id}
            initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1, duration: 0.4, ease: [0.34, 1.2, 0.64, 1] }}
            className="relative rounded-2xl p-3 overflow-hidden"
            style={{ background: acc.bg, border: `1px solid ${acc.border}` }}
          >
            {/* Number badge */}
            <div className="flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono font-black flex-shrink-0 mt-0.5"
                style={{ background: `${acc.num}18`, color: acc.num, border: `1px solid ${acc.num}35` }}>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  {c.verified && (
                    <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: '#14B8A6' }}>✓ verified</span>
                  )}
                  {evTypes.map(t => {
                    const cfg = EV_CFG[t!] ?? EV_DEF
                    return (
                      <span key={t} className="text-[8px] font-mono px-1.5 py-0.5 rounded-full"
                        style={{ background: `${cfg.color}15`, color: cfg.color, border: `1px solid ${cfg.color}25` }}>
                        {cfg.label}
                      </span>
                    )
                  })}
                </div>
                <p className="text-[12px] font-body leading-relaxed" style={{ color: '#C4D8EE' }}>
                  <Hl text={c.text} />
                </p>
                {/* Source chips */}
                {c.source_ids.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {c.source_ids.slice(0, 3).map(id => {
                      const ev = evMap[id]; if (!ev) return null
                      const cfg = EV_CFG[ev.type] ?? EV_DEF
                      return (
                        <button key={id} onClick={() => onClick(ev)}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono cursor-pointer transition-all hover:brightness-125"
                          style={{ background: `${cfg.color}12`, color: cfg.color, border: `1px solid ${cfg.color}25` }}>
                          {cfg.icon} {id.split(':').pop()?.slice(0, 7)}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

/* ══════════════════════════════════════════════════
   5. FACTS GRID  (all claims)
══════════════════════════════════════════════════ */
function FactsGrid({ claims, evMap, flags, onClick }: {
  claims: CaseFileType['claims']; evMap: Record<string, Evidence>
  flags: CaseFileType['critique']; onClick: (e: Evidence) => void
}) {
  return (
    <div className="space-y-2">
      {claims.map((c, i) => {
        const myFlags = flags.filter(f => f.claim_id === c.id)
        const flagged = myFlags.length > 0
        const accent = flagged ? '#F87171'
          : ['#F59E0B','#14B8A6','#8B5CF6','#FCD34D','#14B8A6'][i % 5]
        return (
          <motion.div key={c.id}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-xl overflow-hidden"
            style={{
              border: `1px solid ${accent}22`,
              borderLeft: `3px solid ${accent}`,
              background: flagged ? 'rgba(248,113,113,0.04)' : 'rgba(15,30,56,0.5)',
            }}
          >
            <div className="p-3 flex gap-2.5">
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-mono font-bold flex-shrink-0 mt-0.5"
                style={{ background: `${accent}18`, color: accent }}>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[8.5px] font-mono uppercase tracking-wider mb-1" style={{ color: flagged ? '#F87171' : '#14B8A6' }}>
                  {flagged ? '⚠ Flagged' : '✓ Verified'}
                </p>
                <p className="text-[12px] font-body leading-relaxed" style={{ color: '#C4D8EE' }}>
                  <Hl text={c.text} />
                </p>
                {c.source_ids.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {c.source_ids.map(id => {
                      const ev = evMap[id]; if (!ev) return null
                      const cfg = EV_CFG[ev.type] ?? EV_DEF
                      return (
                        <button key={id} onClick={() => onClick(ev)}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-mono cursor-pointer hover:brightness-125 transition-all"
                          style={{ background: `${cfg.color}12`, color: cfg.color, border: `1px solid ${cfg.color}28` }}>
                          {cfg.icon} {id.split(':').pop()?.slice(0, 7)}
                        </button>
                      )
                    })}
                  </div>
                )}
                {myFlags.map((f, j) => (
                  <div key={j} className="mt-1.5 flex gap-1.5 items-start">
                    <span style={{ color: '#F87171' }} className="text-[9px] flex-shrink-0 mt-0.5">⚠</span>
                    <p className="text-[10px] font-body" style={{ color: 'rgba(248,113,113,0.75)' }}>{f.issue}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

/* ══════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════ */
export default function CaseFile({ caseFile, repo, filePath }: Props) {
  const [activeEv, setActiveEv] = useState<Evidence | null>(null)
  const [tab, setTab] = useState<'overview' | 'map' | 'facts'>('overview')

  const verified = caseFile.claims.filter(c => c.verified).length
  const total    = caseFile.claims.length
  const evCount  = Object.keys(caseFile.evidence_map).length
  const flagCount = caseFile.critique.length

  // Extract author/date from blame evidence
  const { author, date, commitMsg } = useMemo(() => {
    const evs = Object.values(caseFile.evidence_map)
    const blame  = evs.find(e => e.type === 'blame')
    const commit = evs.find(e => e.type === 'commit')
    let author = '', date = '', commitMsg = ''
    if (blame?.content) {
      const entries = (blame.content as { blame_entries?: Array<{ author: string; author_date: string }> }).blame_entries
      if (entries?.[0]) { author = entries[0].author ?? ''; date = (entries[0].author_date ?? '').split(' ')[0] }
    }
    if (commit?.content) commitMsg = ((commit.content as { message?: string }).message ?? '').split('\n')[0].slice(0, 55)
    return { author, date, commitMsg }
  }, [caseFile.evidence_map])

  const TABS: { key: typeof tab; label: string; icon: string }[] = [
    { key: 'overview', label: 'Overview', icon: '⚡' },
    { key: 'map',      label: 'Evidence', icon: '🕸' },
    { key: 'facts',    label: `${verified} Facts`, icon: '✓' },
  ]

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="flex-1 min-h-0 flex flex-col overflow-hidden">

        {/* ── Header ──────────────────────────────── */}
        <div className="px-4 pt-3.5 pb-3 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(26,46,74,0.5)' }}>
          {/* File row */}
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
              style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>📋</div>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-mono uppercase tracking-[0.18em]" style={{ color: '#F59E0B' }}>Case File</p>
              <p className="text-[11px] font-mono truncate" style={{ color: '#5A7898' }}>{filePath.split('/').pop()}</p>
            </div>
          </div>

          {/* Stat chips */}
          <div className="flex flex-wrap gap-1.5">
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-mono"
              style={{ background: 'rgba(20,184,166,0.1)', border: '1px solid rgba(20,184,166,0.2)', color: '#14B8A6' }}>
              ✓ {verified}/{total} verified
            </span>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-mono"
              style={{ background: 'rgba(15,30,56,0.8)', border: '1px solid rgba(26,46,74,0.8)', color: '#5A7898' }}>
              📎 {evCount} sources
            </span>
            {flagCount > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-mono"
                style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', color: '#F87171' }}>
                ⚠ {flagCount} flagged
              </span>
            )}
          </div>
        </div>

        {/* ── Tabs ────────────────────────────────── */}
        <div className="flex flex-shrink-0 px-3 pt-2 pb-0 gap-1">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-mono uppercase tracking-wider transition-all duration-200 relative"
              style={{
                background: tab === t.key ? 'rgba(245,158,11,0.1)' : 'transparent',
                color: tab === t.key ? '#F59E0B' : '#3B5270',
                border: tab === t.key ? '1px solid rgba(245,158,11,0.2)' : '1px solid transparent',
              }}>
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* ── Tab bodies ──────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
          <AnimatePresence mode="wait">

            {/* ── OVERVIEW ───────────────────────── */}
            {tab === 'overview' && (
              <motion.div key="overview"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="space-y-5">

                {/* Gauge + author */}
                <div className="flex items-center gap-4 p-3 rounded-2xl"
                  style={{ background: 'rgba(15,30,56,0.6)', border: '1px solid rgba(26,46,74,0.7)' }}>
                  <ConfidenceGauge verified={verified} total={total} />
                  <div className="flex-1 min-w-0 space-y-2">
                    {author && (
                      <div>
                        <p className="text-[8.5px] font-mono uppercase tracking-widest mb-0.5" style={{ color: '#3B5270' }}>Last author</p>
                        <p className="text-[12px] font-mono font-semibold truncate" style={{ color: '#C4D8EE' }}>{author}</p>
                      </div>
                    )}
                    {date && (
                      <div>
                        <p className="text-[8.5px] font-mono uppercase tracking-widest mb-0.5" style={{ color: '#3B5270' }}>Date</p>
                        <p className="text-[12px] font-mono" style={{ color: '#C4D8EE' }}>{date}</p>
                      </div>
                    )}
                    {commitMsg && (
                      <div className="pt-1.5" style={{ borderTop: '1px solid rgba(26,46,74,0.6)' }}>
                        <p className="text-[10px] font-mono truncate" style={{ color: 'rgba(245,158,11,0.75)' }}>
                          💬 "{commitMsg}"
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Evidence breakdown bars */}
                <div className="p-3 rounded-2xl space-y-3"
                  style={{ background: 'rgba(15,30,56,0.4)', border: '1px solid rgba(26,46,74,0.6)' }}>
                  <p className="text-[9px] font-mono uppercase tracking-[0.15em]" style={{ color: '#3B5270' }}>
                    Evidence breakdown
                  </p>
                  <EvidenceBars evMap={caseFile.evidence_map} />
                </div>

                {/* Top 3 findings */}
                <div>
                  <p className="text-[9px] font-mono uppercase tracking-[0.15em] mb-2.5" style={{ color: '#3B5270' }}>
                    Key findings
                  </p>
                  <FindingCards
                    claims={caseFile.claims}
                    evMap={caseFile.evidence_map}
                    onClick={e => setActiveEv(e)}
                  />
                </div>
              </motion.div>
            )}

            {/* ── MAP ────────────────────────────── */}
            {tab === 'map' && (
              <motion.div key="map"
                initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                <p className="text-[9px] font-mono uppercase tracking-[0.15em] mb-3 text-center" style={{ color: '#3B5270' }}>
                  Evidence constellation — click nodes to inspect
                </p>
                <EvidenceConstellation
                  evMap={caseFile.evidence_map}
                  onSelect={e => setActiveEv(e)}
                />
                {/* Legend */}
                <div className="mt-4 grid grid-cols-2 gap-1.5">
                  {Object.entries(EV_CFG).map(([type, cfg]) => {
                    const count = Object.values(caseFile.evidence_map).filter(e => e.type === type).length
                    if (!count) return null
                    return (
                      <div key={type} className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl"
                        style={{ background: `${cfg.color}0d`, border: `1px solid ${cfg.color}22` }}>
                        <span className="text-[11px]">{cfg.icon}</span>
                        <span className="text-[10px] font-mono" style={{ color: cfg.color }}>{cfg.label}</span>
                        <span className="ml-auto text-[10px] font-mono font-bold" style={{ color: cfg.color }}>×{count}</span>
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            )}

            {/* ── FACTS ──────────────────────────── */}
            {tab === 'facts' && (
              <motion.div key="facts"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <FactsGrid
                  claims={caseFile.claims}
                  evMap={caseFile.evidence_map}
                  flags={caseFile.critique}
                  onClick={e => setActiveEv(e)}
                />
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>

      <AnimatePresence>
        {activeEv && <EvidencePanel evidence={activeEv} onClose={() => setActiveEv(null)} />}
      </AnimatePresence>
    </>
  )
}
