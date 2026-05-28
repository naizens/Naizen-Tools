import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent:  'rgb(var(--accent) / <alpha-value>)',
        blue:    'rgb(var(--blue) / <alpha-value>)',
        success: 'rgb(var(--success) / <alpha-value>)',
        warn:    'rgb(var(--warn) / <alpha-value>)',
        amber:   'rgb(var(--amber) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        app:     'var(--bg)',
        muted:   'rgb(var(--muted) / <alpha-value>)',
      },
    },
  },
  plugins: [],
} satisfies Config
