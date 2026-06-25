'use client'
import type { Claim, Evidence, Flag } from '@/lib/types'
import EvidenceChip from './EvidenceChip'
import CriticFlag from './CriticFlag'

interface Props {
  claim: Claim
  evidenceMap: Record<string, Evidence>
  flags: Flag[]
  onEvidenceClick: (ev: Evidence) => void
}

export default function ClaimCard({ claim, evidenceMap, flags, onEvidenceClick }: Props) {
  const myFlags = flags.filter(f => f.claim_id === claim.id)
  const isFlagged = myFlags.length > 0
  const hasCritical = myFlags.some(f => f.severity === 'critical')

  return (
    <div className={`rounded-lg p-4 border transition ${
      isFlagged
        ? 'border-rust/30 bg-rust/5'
        : claim.verified
          ? 'border-verdigris/20 bg-verdigris/5'
          : 'border-mist/10 bg-slate/50'
    }`}>
      {/* Claim text */}
      <div className="flex items-start gap-2">
        <span className={`mt-0.5 text-sm flex-shrink-0 ${
          hasCritical ? 'text-rust' : claim.verified ? 'text-verdigris' : 'text-mist/30'
        }`}>
          {hasCritical ? '⚑' : claim.verified ? '✓' : '○'}
        </span>
        <p
          className={`text-sm font-body leading-relaxed flex-1 ${
            isFlagged ? 'text-mist/70 decoration-rust underline decoration-wavy decoration-1 underline-offset-2' : 'text-mist'
          }`}
        >
          {claim.text}
        </p>
      </div>

      {/* Evidence chips */}
      {claim.source_ids.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3 pl-5">
          {claim.source_ids.map(id => {
            const ev = evidenceMap[id]
            return ev ? (
              <EvidenceChip key={id} evidence={ev} onClick={onEvidenceClick} />
            ) : (
              <span key={id} className="text-[11px] font-mono text-mist/20 px-2 py-0.5 border border-mist/10 rounded">
                {id.slice(0, 12)}
              </span>
            )
          })}
        </div>
      )}

      {/* Critic flags */}
      {myFlags.length > 0 && (
        <div className="mt-3 space-y-1.5 pl-5">
          {myFlags.map((f, i) => <CriticFlag key={i} flag={f} />)}
        </div>
      )}
    </div>
  )
}
