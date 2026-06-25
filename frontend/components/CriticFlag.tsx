import type { Flag } from '@/lib/types'

interface Props {
  flag: Flag
}

export default function CriticFlag({ flag }: Props) {
  const isCritical = flag.severity === 'critical'
  return (
    <div
      className={`
        rounded-md px-3 py-2 border-l-2 text-xs font-body
        ${isCritical
          ? 'border-rust bg-rust/10 text-rust'
          : 'border-rust/50 bg-rust/5 text-rust/70'}
      `}
    >
      <div className="flex items-center gap-2 mb-0.5">
        <span className={`text-[10px] uppercase tracking-wider font-mono ${isCritical ? 'text-rust' : 'text-rust/60'}`}>
          Critic Flag
        </span>
        <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase ${isCritical ? 'bg-rust/20' : 'bg-rust/10'}`}>
          {flag.severity}
        </span>
        <span className="text-[10px] font-mono text-mist/30 ml-auto">{flag.claim_id}</span>
      </div>
      <p className="leading-relaxed">{flag.issue}</p>
    </div>
  )
}
