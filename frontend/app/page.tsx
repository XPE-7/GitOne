'use client'
import { useEffect, useRef, useState } from 'react'
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

/* ── Typing animation ──────────────────────────────── */
const QUERIES = [
  'deregister_hook in hooks.py',
  'Response.__bool__ in models.py',
  'retry logic in adapters.py',
  'auth middleware in sessions.py',
  'stream parsing in api.py',
]

function TypedQuery() {
  const [qi, setQi] = useState(0)
  const [displayed, setDisplayed] = useState('')
  const [phase, setPhase] = useState<'typing' | 'pause' | 'erasing'>('typing')
  useEffect(() => {
    const target = QUERIES[qi]
    let t: ReturnType<typeof setTimeout>
    if (phase === 'typing') {
      if (displayed.length < target.length) t = setTimeout(() => setDisplayed(target.slice(0, displayed.length + 1)), 50)
      else t = setTimeout(() => setPhase('pause'), 1800)
    } else if (phase === 'pause') {
      t = setTimeout(() => setPhase('erasing'), 300)
    } else {
      if (displayed.length > 0) t = setTimeout(() => setDisplayed(d => d.slice(0, -1)), 24)
      else { setQi(q => (q + 1) % QUERIES.length); setPhase('typing') }
    }
    return () => clearTimeout(t)
  }, [displayed, phase, qi])
  return (
    <span className="text-gold font-mono">
      {displayed}
      <span className="animate-blink inline-block w-0.5 h-3.5 bg-gold mx-0.5 align-middle" />
    </span>
  )
}

/* ── Background atmosphere ─────────────────────────── */
function Atmosphere() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden>
      <motion.div animate={{ opacity: [0.3, 0.55, 0.3] }} transition={{ duration: 9, repeat: Infinity }}
        className="absolute -top-48 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full"
        style={{ background: 'radial-gradient(ellipse, rgba(245,158,11,0.10) 0%, transparent 65%)' }} />
      <motion.div animate={{ opacity: [0.15, 0.3, 0.15] }} transition={{ duration: 11, repeat: Infinity, delay: 2 }}
        className="absolute top-1/2 -right-48 w-[600px] h-[600px] rounded-full"
        style={{ background: 'radial-gradient(ellipse, rgba(20,184,166,0.08) 0%, transparent 65%)' }} />
      <motion.div animate={{ opacity: [0.1, 0.22, 0.1] }} transition={{ duration: 13, repeat: Infinity, delay: 5 }}
        className="absolute bottom-0 left-1/4 w-[500px] h-[500px] rounded-full"
        style={{ background: 'radial-gradient(ellipse, rgba(139,92,246,0.08) 0%, transparent 65%)' }} />
    </div>
  )
}

/* ── Feature card ──────────────────────────────────── */
function FeatureCard({ icon, title, desc, delay, accent }: { icon: string; title: string; desc: string; delay: number; accent: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }} transition={{ duration: 0.55, delay }}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      className="group relative p-6 rounded-2xl bg-panel border border-line hover:border-subtle transition-all duration-300 overflow-hidden"
    >
      <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${accent}`} />
      <div className="relative">
        <div className="w-10 h-10 rounded-xl bg-surface border border-line flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform duration-200">
          {icon}
        </div>
        <h3 className="font-display font-bold text-snow text-[15px] mb-2">{title}</h3>
        <p className="text-body text-[13px] leading-relaxed">{desc}</p>
      </div>
    </motion.div>
  )
}

export default function Home() {
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const opacity = useTransform(scrollYProgress, [0, 0.65], [1, 0])
  const y = useTransform(scrollYProgress, [0, 0.65], [0, -80])

  return (
    <div className="min-h-screen bg-base text-bright overflow-x-hidden dot-grid">
      <Atmosphere />

      {/* ── Nav ────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center px-6 border-b border-line/50"
        style={{ background: 'rgba(8,13,26,0.85)', backdropFilter: 'blur(20px)' }}>
        <div className="flex items-center gap-2.5 mr-auto">
          <div className="w-7 h-7 rounded-lg border border-gold/30 flex items-center justify-center"
            style={{ background: 'rgba(245,158,11,0.1)' }}>
            <svg width="13" height="13" viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="20" r="17" stroke="#F59E0B" strokeWidth="2.5"/>
              <circle cx="20" cy="13" r="4" fill="#F59E0B"/>
              <path d="M20 17v11" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="13" cy="30" r="3.5" stroke="#C4D8EE" strokeWidth="1.5"/>
              <circle cx="27" cy="30" r="3.5" stroke="#C4D8EE" strokeWidth="1.5"/>
            </svg>
          </div>
          <span className="font-display font-bold text-snow text-sm tracking-tight">GitOne</span>
          <span className="text-[9px] font-mono text-muted border border-line bg-surface px-1.5 py-0.5 rounded-md">beta</span>
        </div>
        <Link href="/investigate"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gold text-base font-display font-bold text-[13px] hover:brightness-105 transition-all shadow-gold-sm">
          Open App →
        </Link>
      </nav>

      {/* ── Hero ───────────────────────────────────────── */}
      <section ref={heroRef} className="relative min-h-screen flex flex-col items-center justify-center pt-14 px-6 text-center">
        <motion.div style={{ opacity, y }} className="max-w-4xl mx-auto">

          {/* Live badge */}
          <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-gold/25 text-[11px] font-mono text-gold mb-10"
            style={{ background: 'rgba(245,158,11,0.06)' }}>
            <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-gold" />
            </span>
            AI code forensics · Powered by LangGraph + Cerebras
          </motion.div>

          {/* Headline — words stagger up */}
          <div className="mb-6">
            {['Why does this', 'code exist?'].map((line, i) => (
              <div key={i} className="overflow-hidden leading-none">
                <motion.div
                  initial={{ y: '105%' }}
                  animate={{ y: 0 }}
                  transition={{ duration: 0.8, delay: 0.1 + i * 0.15, ease: [0.16, 1, 0.3, 1] }}
                >
                  <span className={`block font-display font-black tracking-tighter text-[clamp(52px,9vw,108px)] ${
                    i === 1 ? 'text-glow' : 'text-snow'
                  }`}>
                    {line}
                  </span>
                </motion.div>
              </div>
            ))}
          </div>

          {/* Subheadline */}
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="text-body text-lg md:text-xl font-body leading-relaxed max-w-2xl mx-auto mb-10">
            Select any lines in a public GitHub repo.
            GitOne traces every commit, PR, and issue —
            then writes a <span className="text-bright font-semibold">verified case file</span> explaining
            exactly why that code exists.
          </motion.p>

          {/* CTAs */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.65 }}
            className="flex flex-wrap items-center justify-center gap-3 mb-16">
            <Link href="/investigate"
              className="group inline-flex items-center gap-2.5 px-8 py-4 bg-gold text-base font-display font-bold rounded-2xl hover:brightness-110 transition-all shadow-gold-lg text-[15px]">
              <span>Start Investigating</span>
              <motion.span animate={{ x: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}>→</motion.span>
            </Link>
            <a href="https://github.com"
              className="inline-flex items-center gap-2 px-6 py-4 rounded-2xl bg-panel border border-line hover:border-subtle text-body hover:text-snow text-[15px] font-display font-medium transition-all duration-200">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="flex-shrink-0"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
              View Source
            </a>
          </motion.div>
        </motion.div>

        {/* Live query pill at bottom */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
          className="absolute bottom-14 left-1/2 -translate-x-1/2 w-full max-w-xs px-4">
          <div className="p-3 rounded-xl border border-line/70 text-left"
            style={{ background: 'rgba(12,21,41,0.8)', backdropFilter: 'blur(12px)' }}>
            <p className="text-[9px] font-mono text-muted uppercase tracking-widest mb-1">Currently investigating</p>
            <p className="text-[12px]"><span className="text-dim font-mono">psf/requests /</span> <TypedQuery /></p>
          </div>
          <motion.div animate={{ y: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 2 }}
            className="text-center text-muted text-xl mt-4">↓</motion.div>
        </motion.div>
      </section>

      {/* ── Steps section ──────────────────────────────── */}
      <section className="py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-16">
            <p className="text-[10px] font-mono text-gold uppercase tracking-[0.2em] mb-4">How it works</p>
            <h2 className="font-display font-black text-snow text-[clamp(32px,5vw,56px)] tracking-tight">
              From code to <span className="text-glow">context</span>
            </h2>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { n: '01', icon: '🎯', title: 'Select lines', desc: 'Drag to select any lines in the syntax-highlighted code viewer. See live line count as you drag.', glow: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
              { n: '02', icon: '🔍', title: 'Agent investigates', desc: 'LangGraph traces git blame → commits → PRs → issues, following every cross-reference automatically.', glow: 'rgba(20,184,166,0.07)', border: 'rgba(20,184,166,0.2)' },
              { n: '03', icon: '📋', title: 'Case file delivered', desc: 'A cited, critic-verified case file explains exactly why the code exists. Click any badge to see raw evidence.', glow: 'rgba(139,92,246,0.07)', border: 'rgba(139,92,246,0.2)' },
            ].map((s, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ duration: 0.55, delay: i * 0.14 }}
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                className="relative rounded-2xl border p-7 overflow-hidden"
                style={{ background: `linear-gradient(145deg, ${s.glow} 0%, rgba(15,30,56,0.9) 60%)`, borderColor: s.border }}
              >
                <div className="absolute top-5 right-5 font-mono text-[11px] text-muted">{s.n}</div>
                <div className="text-3xl mb-5">{s.icon}</div>
                <h3 className="font-display font-bold text-snow text-base mb-2">{s.title}</h3>
                <p className="text-body text-[13px] leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-12">
            <p className="text-[10px] font-mono text-gold uppercase tracking-[0.2em] mb-4">Capabilities</p>
            <h2 className="font-display font-black text-snow text-[clamp(28px,4vw,48px)] tracking-tight">
              Built for real <span className="text-glow">investigation</span>
            </h2>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FeatureCard delay={0}    icon="🧠" title="Agentic reasoning"    accent="bg-gold-radial" desc="An LLM agent decides what evidence to collect, follows cross-references, and knows when the investigation is complete." />
            <FeatureCard delay={0.08} icon="🔗" title="Every claim cited"    accent="bg-teal-radial" desc="Each statement links to real evidence: commit SHAs, PR numbers, issues. Click any badge to open the raw source." />
            <FeatureCard delay={0.16} icon="🛡️" title="Critic verified"      accent="bg-gold-radial" desc="A critic agent independently reviews every claim and flags anything that overreaches its cited evidence." />
            <FeatureCard delay={0.24} icon="⚡" title="Live streaming"        accent="bg-teal-radial" desc="Watch each tool call, evidence find, and reasoning step appear in real time as the agent works." />
            <FeatureCard delay={0.32} icon="🎨" title="Syntax highlighting"  accent="bg-gold-radial" desc="Full Shiki syntax highlighting for 20+ languages. Drag any line range to select it for investigation." />
            <FeatureCard delay={0.40} icon="🌐" title="Any public repo"      accent="bg-teal-radial" desc="Works on any public GitHub repository. Just paste the URL and start selecting lines immediately." />
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────── */}
      <section className="py-32 px-6">
        <div className="max-w-xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="relative inline-flex mb-8">
              <div className="w-20 h-20 rounded-2xl bg-panel border border-line flex items-center justify-center text-4xl shadow-float animate-float">
                🕵️
              </div>
              <div className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-gold flex items-center justify-center text-base text-[11px] font-bold shadow-gold-sm">
                <motion.span animate={{ rotate: [0, 20, -20, 0] }} transition={{ repeat: Infinity, duration: 2 }}>!</motion.span>
              </div>
            </div>
            <h2 className="font-display font-black text-snow text-[clamp(32px,6vw,60px)] tracking-tight mb-4">
              Ready to dig in?
            </h2>
            <p className="text-body text-lg mb-10 font-body leading-relaxed">
              Pick any public repo. Select any lines.<br />
              Get a verified answer in under 60 seconds.
            </p>
            <Link href="/investigate"
              className="inline-flex items-center gap-3 px-10 py-5 bg-gold text-base font-display font-black rounded-2xl hover:brightness-110 transition-all shadow-gold-lg text-lg">
              Start Investigating
              <motion.span animate={{ x: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 1.4 }}>→</motion.span>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────── */}
      <footer className="border-t border-line/40 py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-dim text-sm">GitOne</span>
            <span className="text-muted text-xs">— AI code forensics</span>
          </div>
          <p className="text-dim text-xs font-mono">LangGraph · Cerebras · Next.js · Shiki</p>
        </div>
      </footer>
    </div>
  )
}
