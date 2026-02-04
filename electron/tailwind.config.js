/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/renderer/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'terminal': {
          black: '#0a0a0b',
          dark: '#111113',
          mid: '#1a1a1d',
          light: '#252528',
          border: '#2a2a2e',
        },
        'neon': {
          green: '#00ff88',
          'green-dim': '#00cc6a',
          cyan: '#00e5ff',
          'cyan-dim': '#00b8cc',
          red: '#ff3366',
          orange: '#ff9500',
          purple: '#a855f7',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'IBM Plex Mono', 'monospace'],
        display: ['Archivo', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-neon': 'pulseNeon 2s ease-in-out infinite',
        'blink': 'blink 1s step-end infinite',
        'terminal-boot': 'terminalBoot 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'glitch': 'glitch 0.3s ease-in-out',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-right': 'slideRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      boxShadow: {
        'neon': '0 0 10px rgba(0, 255, 136, 0.3), 0 0 20px rgba(0, 255, 136, 0.1)',
        'neon-strong': '0 0 20px rgba(0, 255, 136, 0.5), 0 0 40px rgba(0, 255, 136, 0.2)',
        'neon-red': '0 0 10px rgba(255, 51, 102, 0.3), 0 0 20px rgba(255, 51, 102, 0.1)',
      },
    },
  },
  plugins: [],
}
