import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Depth scale
        void:    '#05080F',
        base:    '#080D1A',
        surface: '#0C1529',
        panel:   '#0F1E38',
        raise:   '#132244',
        line:    '#1A2E4A',
        subtle:  '#243554',
        // Text scale
        muted:   '#3B5270',
        dim:     '#5A7898',
        body:    '#8BA8C4',
        bright:  '#C4D8EE',
        snow:    '#E6F0FA',
        // Accents
        gold:    '#F59E0B',
        'gold-hi': '#FCD34D',
        teal:    '#14B8A6',
        violet:  '#8B5CF6',
        crimson: '#F87171',
        ember:   '#EF4444',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Space Grotesk', 'sans-serif'],
        body:    ['var(--font-body)',    'Inter',          'sans-serif'],
        mono:    ['var(--font-mono)',    'JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'panel':   '0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(26,46,74,0.8)',
        'float':   '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(26,46,74,0.6)',
        'gold-sm': '0 0 0 1px rgba(245,158,11,0.3), 0 0 12px rgba(245,158,11,0.15)',
        'gold-lg': '0 0 0 1px rgba(245,158,11,0.2), 0 0 30px rgba(245,158,11,0.12), 0 0 80px rgba(245,158,11,0.05)',
        'teal-sm': '0 0 0 1px rgba(20,184,166,0.3), 0 0 16px rgba(20,184,166,0.12)',
        'inset':   'inset 0 1px 0 rgba(138,168,196,0.06)',
      },
      backgroundImage: {
        'gold-radial': 'radial-gradient(ellipse at center, rgba(245,158,11,0.15) 0%, transparent 70%)',
        'teal-radial': 'radial-gradient(ellipse at center, rgba(20,184,166,0.12) 0%, transparent 70%)',
        'void-radial': 'radial-gradient(ellipse at center, rgba(12,21,41,0.9) 0%, var(--base) 100%)',
      },
      animation: {
        'shimmer':      'shimmer 1.6s ease-in-out infinite',
        'float':        'float-y 5s ease-in-out infinite',
        'float-slow':   'float-slow 8s ease-in-out infinite',
        'pulse-ring':   'pulse-ring 2s ease-out infinite',
        'glow-breathe': 'glow-breathe 2.5s ease-in-out infinite',
        'blink':        'blink 1.1s step-end infinite',
        'spin-slow':    'spin 4s linear infinite',
        'gradient-pan': 'gradient-pan 5s ease infinite',
        'border-spin':  'border-rotate 4s linear infinite',
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition:  '200% 0' },
        },
        'float-y': {
          '0%,100%': { transform: 'translateY(0px)' },
          '50%':     { transform: 'translateY(-14px)' },
        },
        'float-slow': {
          '0%,100%': { transform: 'translateY(0px) rotate(0deg)' },
          '33%':     { transform: 'translateY(-8px) rotate(1deg)' },
          '66%':     { transform: 'translateY(-4px) rotate(-1deg)' },
        },
        'pulse-ring': {
          '0%':     { boxShadow: '0 0 0 0 rgba(245,158,11,0.5)' },
          '70%':    { boxShadow: '0 0 0 10px rgba(245,158,11,0)' },
          '100%':   { boxShadow: '0 0 0 0 rgba(245,158,11,0)' },
        },
        'glow-breathe': {
          '0%,100%': { opacity: '0.5' },
          '50%':     { opacity: '1' },
        },
        'blink': {
          '0%,100%': { opacity: '1' },
          '50%':     { opacity: '0' },
        },
        'gradient-pan': {
          '0%,100%': { backgroundPosition: '0% 50%' },
          '50%':     { backgroundPosition: '100% 50%' },
        },
      },
    },
  },
  plugins: [],
}

export default config
