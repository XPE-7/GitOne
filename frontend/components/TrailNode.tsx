'use client'
import { motion } from 'framer-motion'
import type { TrailStep } from '@/lib/types'

const TYPE_CFG: Record<string, { label: string; icon: string; dotColor: string; textColor: string; bgColor: string; borderColor: string }> = {
  tool:      { label: 'Fetching',   icon: '⟳',  dotColor: '#F59E0B', textColor: '#F59E0B', bgColor: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.2)' },
  evidence:  { label: 'Found',      icon: '📎', dotColor: '#14B8A6', textColor: '#14B8A6', bgColor: 'rgba(20,184,166,0.07)', borderColor: 'rgba(20,184,166,0.2)' },
  synthesis: { label: 'Writing',    icon: '✍️', dotColor: '#8B5CF6', textColor: '#8B5CF6', bgColor: 'rgba(139,92,246,0.07)', borderColor: 'rgba(139,92,246,0.2)' },
  critic:    { label: 'Verifying',  icon: '🛡️', dotColor: '#F87171', textColor: '#F87171', bgColor: 'rgba(248,113,113,0.07)', borderColor: 'rgba(248,113,113,0.2)' },
  node:      { label: 'Running',    icon: '⚙️', dotColor: '#5A7898', textColor: '#5A7898', bgColor: 'rgba(90,120,152,0.05)',  borderColor: 'rgba(90,120,152,0.15)' },
}

export default function TrailNode({ step, isActive, index }: { step: TrailStep; isActive: boolean; index: number }) {
  const c = TYPE_CFG[step.type] ?? TYPE_CFG.node

  return (
    <motion.div
      initial={{ opacity: 0, x: -14 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index * 0.05, 0.5), ease: [0.34, 1.2, 0.64, 1] }}
      className="relative flex gap-3 pb-2.5"
    >
      {/* Icon + vertical line */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className="relative">
          {/* Outer ping ring when active */}
          {isActive && (
            <motion.div
              className="absolute inset-0 rounded-full"
              animate={{ scale: [1, 1.8], opacity: [0.6, 0] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              style={{ background: c.dotColor }}
            />
          )}
          <div
            className="relative w-7 h-7 rounded-full border flex items-center justify-center text-[12px] z-10 transition-all duration-300"
            style={{
              background: isActive ? c.bgColor : 'rgba(12,21,41,0.8)',
              borderColor: isActive ? c.borderColor : 'rgba(26,46,74,0.8)',
              boxShadow: isActive ? `0 0 16px ${c.dotColor}22` : 'none',
            }}
          >
            {isActive && step.type === 'tool' ? (
              <motion.span style={{ color: c.dotColor }}
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
                className="inline-block text-[14px] font-mono">⟳</motion.span>
            ) : (
              <span className="text-[12px]">{c.icon}</span>
            )}
          </div>
        </div>
        {/* Connecting line */}
        <div className="w-px flex-1 mt-1" style={{ background: 'rgba(26,46,74,0.7)' }} />
      </div>

      {/* Content card */}
      <div
        className="flex-1 min-w-0 rounded-xl p-2.5 mb-1 border transition-all duration-300"
        style={{
          background: isActive ? c.bgColor : 'transparent',
          borderColor: isActive ? c.borderColor : 'transparent',
        }}
      >
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[8.5px] font-mono uppercase tracking-[0.15em]" style={{ color: c.textColor }}>
            {c.label}
          </span>
          {isActive && (
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <motion.div key={i}
                  className="w-1 h-1 rounded-full"
                  style={{ background: c.dotColor, opacity: 0.5 }}
                  animate={{ opacity: [0.2, 0.8, 0.2], scale: [0.8, 1.2, 0.8] }}
                  transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.2 }}
                />
              ))}
            </div>
          )}
        </div>
        <p className="text-[11.5px] font-mono truncate leading-tight"
          style={{ color: isActive ? '#C4D8EE' : '#5A7898' }}>
          {step.label}
        </p>
        {step.detail && (
          <p className="text-[10px] mt-1 leading-snug line-clamp-2 font-body"
            style={{ color: '#3B5270' }}>
            {step.detail}
          </p>
        )}
      </div>
    </motion.div>
  )
}
