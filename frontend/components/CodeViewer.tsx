'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { BundledLanguage, Highlighter } from 'shiki'
import { createHighlighter } from 'shiki'

const LANG_MAP: Record<string, BundledLanguage> = {
  '.py':'python', '.ts':'typescript', '.tsx':'tsx', '.js':'javascript',
  '.jsx':'jsx', '.go':'go', '.rs':'rust', '.md':'markdown',
  '.json':'json', '.yaml':'yaml', '.yml':'yaml', '.sh':'bash',
  '.css':'css', '.html':'html', '.rb':'ruby', '.java':'java',
  '.cpp':'cpp', '.c':'c', '.cs':'csharp',
}

let _hl: Highlighter | null = null
async function getHl(): Promise<Highlighter> {
  if (!_hl) _hl = await createHighlighter({ themes: ['github-dark-dimmed'], langs: Object.values(LANG_MAP) })
  return _hl
}

function getLang(fp: string): BundledLanguage {
  const ext = fp.match(/\.[^.]+$/)?.[0] ?? ''
  return LANG_MAP[ext] ?? 'text'
}

interface Props {
  content: string; filePath: string
  lineStart: number; lineEnd: number
  onSelect: (s: number, e: number) => void
}

export default function CodeViewer({ content, filePath, lineStart, lineEnd, onSelect }: Props) {
  const [lines, setLines] = useState<string[]>([])
  const [dragStart, setDragStart] = useState<number | null>(null)
  const [liveEnd, setLiveEnd] = useState<number | null>(null)
  const isDragging = useRef(false)

  useEffect(() => {
    let cancelled = false
    setLines([])
    getHl().then(hl => {
      if (cancelled) return
      const html = hl.codeToHtml(content, { lang: getLang(filePath), theme: 'github-dark-dimmed' })
      const doc = new DOMParser().parseFromString(html, 'text/html')
      const els = doc.querySelectorAll('span.line')
      setLines(Array.from(els).map(el => el.innerHTML || '&nbsp;'))
    })
    return () => { cancelled = true }
  }, [content, filePath])

  // Effective selection bounds — during drag use live values, else committed values
  const selS = dragStart !== null && liveEnd !== null ? Math.min(dragStart, liveEnd) : lineStart
  const selE = dragStart !== null && liveEnd !== null ? Math.max(dragStart, liveEnd) : lineEnd
  const hasSel = selS > 0 && selE >= selS
  const count = hasSel ? selE - selS + 1 : 0

  const getLine = (e: React.MouseEvent | MouseEvent) => {
    const el = (e.target as Element).closest('[data-ln]') as HTMLElement | null
    return el ? Number(el.dataset.ln) : null
  }

  const onDown = useCallback((e: React.MouseEvent) => {
    const ln = getLine(e); if (!ln) return
    isDragging.current = true; setDragStart(ln); setLiveEnd(ln); e.preventDefault()
  }, [])

  const onMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return
    const ln = getLine(e); if (ln) setLiveEnd(ln)
  }, [])

  const onUp = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return
    isDragging.current = false
    const ln = getLine(e) ?? liveEnd
    if (ln !== null && dragStart !== null) onSelect(Math.min(dragStart, ln), Math.max(dragStart, ln))
    setDragStart(null); setLiveEnd(null)
  }, [dragStart, liveEnd, onSelect])

  // Skeleton
  if (!lines.length) {
    return (
      <div className="flex-1 min-h-0 overflow-hidden p-4 space-y-1.5 bg-base">
        {Array.from({ length: 26 }, (_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="skel w-7 h-2.5 flex-shrink-0 opacity-30" />
            <div className="skel h-2.5" style={{ width: `${18 + (i * 41 % 67)}%` }} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-base relative overflow-hidden">
      {/* Floating selection badge */}
      <AnimatePresence>
        {hasSel && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.88 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.88 }}
            transition={{ type: 'spring', stiffness: 500, damping: 28 }}
            className="absolute top-3 right-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-xl font-mono text-[11px] font-bold pointer-events-none shadow-gold-sm"
            style={{ background: '#F59E0B', color: '#080D1A' }}
          >
            <span>L{selS}–{selE}</span>
            <span style={{ opacity: 0.5 }}>·</span>
            <span>{count} line{count !== 1 ? 's' : ''}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hint */}
      <AnimatePresence>
        {!hasSel && lines.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute top-3 right-4 z-20 pointer-events-none">
            <div className="px-2.5 py-1.5 rounded-lg border border-line/70 text-[10px] font-mono text-muted"
              style={{ background: 'rgba(12,21,41,0.85)', backdropFilter: 'blur(8px)' }}>
              Drag to select lines
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scrollable code */}
      <div
        className="flex-1 min-h-0 overflow-auto code-wrap"
        style={{ cursor: isDragging.current ? 'crosshair' : 'default' }}
        onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp}
        onMouseLeave={() => {
          if (!isDragging.current) return
          isDragging.current = false
          if (dragStart !== null && liveEnd !== null) onSelect(Math.min(dragStart, liveEnd), Math.max(dragStart, liveEnd))
          setDragStart(null); setLiveEnd(null)
        }}
      >
        <div className="py-3 min-w-max" style={{ userSelect: dragStart !== null ? 'none' : 'text' }}>
          {lines.map((html, i) => {
            const ln = i + 1
            const sel = hasSel && ln >= selS && ln <= selE
            const edge = sel && (ln === selS || ln === selE)
            return (
              <div key={i} data-ln={ln}
                className={`code-row${sel ? (edge ? ' sel-edge' : ' sel') : ''}`}>
                <span className="ln">{ln}</span>
                <span className="code-content" dangerouslySetInnerHTML={{ __html: html }} />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
