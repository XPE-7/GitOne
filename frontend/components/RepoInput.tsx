'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

function normalize(raw: string) {
  return raw.trim()
    .replace(/^https?:\/\/github\.com\//, '')
    .replace(/\.git$/, '')
    .replace(/\/$/, '')
}

const EXAMPLES = [
  { repo: 'psf/requests',    label: 'requests',  color: 'text-gold' },
  { repo: 'facebook/react',  label: 'react',     color: 'text-teal' },
  { repo: 'torvalds/linux',  label: 'linux',     color: 'text-violet' },
  { repo: 'microsoft/vscode',label: 'vscode',    color: 'text-body' },
]

export default function RepoInput({ onSubmit, loading }: { onSubmit: (r: string) => void; loading?: boolean }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [shakeKey, setShakeKey] = useState(0)
  const [focused, setFocused] = useState(false)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const repo = normalize(value)
    if (!repo.match(/^[\w.\-]+\/[\w.\-]+$/)) {
      setError('Enter owner/repo or paste a GitHub URL')
      setShakeKey(k => k + 1)
      return
    }
    setError('')
    onSubmit(repo)
  }

  return (
    <div className="w-full">
      <motion.div key={shakeKey}
        animate={shakeKey > 0 ? { x: [-12, 12, -8, 8, -3, 3, 0] } : {}}
        transition={{ duration: 0.4 }}>
        <form onSubmit={submit}
          className={`flex items-center rounded-2xl border transition-all duration-200 overflow-hidden ${
            focused
              ? 'border-gold/50 shadow-gold-sm'
              : 'border-line hover:border-subtle'
          }`}
          style={{ background: 'rgba(15,30,56,0.8)' }}>

          {/* Icon */}
          <div className="pl-4 flex-shrink-0">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className={`transition-colors ${focused ? 'text-gold/60' : 'text-muted'}`}>
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>

          <input
            type="text" value={value}
            onChange={e => { setValue(e.target.value); setError('') }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="owner/repo  or  github.com/owner/repo"
            disabled={loading}
            className="flex-1 bg-transparent px-3 py-4 font-mono text-[13px] text-bright placeholder:text-muted focus:outline-none disabled:opacity-40"
          />

          <button type="submit" disabled={loading || !value.trim()}
            className="m-2 px-5 py-2.5 bg-gold text-base font-display font-bold text-[13px] rounded-xl
              hover:brightness-108 active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed
              transition-all duration-150 flex-shrink-0 flex items-center gap-2">
            {loading ? (
              <>
                <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.75, ease: 'linear' }}
                  className="inline-block">↻</motion.span>
                Cloning…
              </>
            ) : <>Open →</>}
          </button>
        </form>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mt-2 text-crimson text-[12px] font-mono pl-1">
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Example pills */}
      <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
        <span className="text-[10px] font-mono text-muted">Try:</span>
        {EXAMPLES.map(ex => (
          <button key={ex.repo} type="button"
            onClick={() => { setValue(ex.repo); setError('') }}
            className={`text-[11px] font-mono ${ex.color} hover:opacity-100 opacity-60 hover:bg-panel px-2.5 py-1 rounded-lg border border-transparent hover:border-line transition-all`}>
            {ex.label}
          </button>
        ))}
      </div>
    </div>
  )
}
