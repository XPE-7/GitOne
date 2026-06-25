'use client'
import type { Evidence } from '@/lib/types'

const TYPE_STYLE: Record<string, string> = {
  commit: 'bg-mist/10 text-mist border-mist/20',
  pr: 'bg-verdigris/10 text-verdigris border-verdigris/30',
  issue: 'bg-amber/10 text-amber border-amber/30',
  blame: 'bg-mist/5 text-mist/50 border-mist/10',
  search: 'bg-mist/5 text-mist/40 border-mist/10',
}

function formatId(id: string): string {
  // commit:abc1234 -> abc1234
  // pr:482 -> PR #482
  // issue:99 -> #99
  if (id.startsWith('pr:')) return `PR #${id.slice(3)}`
  if (id.startsWith('issue:')) return `#${id.slice(6)}`
  if (id.startsWith('commit:')) return id.slice(7, 14)
  if (id.startsWith('blame:')) return 'blame'
  if (id.startsWith('history:')) return 'history'
  if (id.startsWith('search:')) return 'search'
  return id.slice(0, 10)
}

interface Props {
  evidence: Evidence
  onClick: (ev: Evidence) => void
}

export default function EvidenceChip({ evidence, onClick }: Props) {
  const style = TYPE_STYLE[evidence.type] ?? TYPE_STYLE.search

  return (
    <button
      onClick={() => onClick(evidence)}
      title={evidence.summary}
      className={`
        inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-mono
        hover:brightness-125 transition cursor-pointer
        ${style}
      `}
    >
      {formatId(evidence.id)}
    </button>
  )
}
