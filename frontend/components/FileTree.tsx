'use client'
import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Node { name: string; path: string; children: Record<string, Node>; isFile: boolean }

function buildTree(paths: string[]): Record<string, Node> {
  const root: Record<string, Node> = {}
  for (const p of paths) {
    const parts = p.split('/')
    let cur = root
    for (let i = 0; i < parts.length; i++) {
      const k = parts[i]
      const fp = parts.slice(0, i + 1).join('/')
      if (!cur[k]) cur[k] = { name: k, path: fp, children: {}, isFile: i === parts.length - 1 }
      cur = cur[k].children
    }
  }
  return root
}

function sorted(map: Record<string, Node>) {
  return Object.keys(map).sort((a, b) => {
    const af = map[a].isFile, bf = map[b].isFile
    return af !== bf ? (af ? 1 : -1) : a.localeCompare(b)
  })
}

const EXT: Record<string, string> = {
  py:'🐍', ts:'🔷', tsx:'⚛️', js:'🟡', jsx:'⚛️', go:'🐹', rs:'🦀',
  md:'📝', json:'📋', yaml:'⚙️', yml:'⚙️', sh:'💲', css:'🎨',
  scss:'🎨', html:'🌐', rb:'💎', java:'☕', cpp:'⚡', c:'⚡',
  cs:'🔵', vue:'💚', svelte:'🟠', lock:'🔒', toml:'⚙️', env:'🔐',
}
function icon(name: string) {
  if (name === '.gitignore') return '👁️'
  if (name === 'Dockerfile') return '🐳'
  if (name === 'Makefile') return '🔨'
  const ext = name.includes('.') ? name.split('.').pop()?.toLowerCase() ?? '' : ''
  return EXT[ext] ?? '📄'
}

function FileRow({ node, depth, active, onSelect }: { node: Node; depth: number; active: string; onSelect: (p: string) => void }) {
  const isActive = node.path === active
  return (
    <motion.button
      onClick={() => onSelect(node.path)}
      whileHover={{ x: 2 }}
      title={node.path}
      className={`w-full text-left flex items-center gap-1.5 py-1 rounded-lg text-[11.5px] transition-all duration-150 ${
        isActive
          ? 'text-snow'
          : 'text-dim hover:text-body'
      }`}
      style={{
        paddingLeft: `${depth * 14 + 8}px`,
        paddingRight: '8px',
        background: isActive ? 'rgba(245,158,11,0.1)' : undefined,
        borderLeft: isActive ? '2px solid rgba(245,158,11,0.7)' : '2px solid transparent',
      }}
    >
      <span className="text-[11px] flex-shrink-0 opacity-70">{icon(node.name)}</span>
      <span className="font-mono truncate">{node.name}</span>
      {isActive && <span className="ml-auto flex-shrink-0 w-1 h-1 rounded-full bg-gold" />}
    </motion.button>
  )
}

function DirRow({ node, depth, active, onSelect }: { node: Node; depth: number; active: string; onSelect: (p: string) => void }) {
  const [open, setOpen] = useState(depth < 2)
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left flex items-center gap-1.5 py-1 rounded-lg text-[11.5px] font-mono text-dim hover:text-body transition-all"
        style={{ paddingLeft: `${depth * 14 + 8}px`, paddingRight: '8px' }}
      >
        <motion.span
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ duration: 0.15 }}
          className="text-[8px] flex-shrink-0 text-muted"
        >▶</motion.span>
        <span className="text-[11px] flex-shrink-0">📁</span>
        <span className="truncate font-semibold text-body/50">{node.name}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            {sorted(node.children).map(k =>
              node.children[k].isFile
                ? <FileRow key={k} node={node.children[k]} depth={depth + 1} active={active} onSelect={onSelect} />
                : <DirRow  key={k} node={node.children[k]} depth={depth + 1} active={active} onSelect={onSelect} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function FileTree({ entries, activeFile, onSelect }: { entries: string[]; activeFile: string; onSelect: (p: string) => void }) {
  const tree = useMemo(() => buildTree(entries), [entries])

  if (!entries.length) {
    return (
      <div className="p-3 space-y-2">
        {[65, 48, 72, 42, 58, 36, 55, 44].map((w, i) => (
          <div key={i} className="skel h-3" style={{ width: `${w}%`, marginLeft: i % 3 !== 0 ? '12px' : '0' }} />
        ))}
      </div>
    )
  }

  return (
    <div className="overflow-y-auto h-full py-1.5 px-1 select-none text-[11.5px]">
      {sorted(tree).map(k =>
        tree[k].isFile
          ? <FileRow key={k} node={tree[k]} depth={0} active={activeFile} onSelect={onSelect} />
          : <DirRow  key={k} node={tree[k]} depth={0} active={activeFile} onSelect={onSelect} />
      )}
    </div>
  )
}
