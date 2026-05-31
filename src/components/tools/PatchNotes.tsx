import { memo, useEffect } from 'react'

interface Props {
  onClose: () => void
}

interface Entry {
  version: string
  date: string
  sections: { label: string; color: string; items: string[] }[]
}

const ENTRIES: Entry[] = [
  {
    version: '0.3.1',
    date: 'May 31, 2026',
    sections: [
      {
        label: 'Fixed',
        color: 'text-warn',
        items: [
          'Auto Update — the app now correctly finds and installs new updates',
        ],
      },
    ],
  },
  {
    version: '0.3.0',
    date: 'May 31, 2026',
    sections: [
      {
        label: 'New',
        color: 'text-success',
        items: [
          'Enter Key — Anti-AFK can now automatically press Enter on its own interval',
          'Version Number — now shown in the title bar',
        ],
      },
      {
        label: 'Fixed',
        color: 'text-warn',
        items: [
          'System Tray — icon no longer disappears when minimizing the app',
        ],
      },
    ],
  },
  {
    version: '0.2.1',
    date: 'May 28, 2026',
    sections: [
      {
        label: 'Fixed',
        color: 'text-warn',
        items: [
          'App Icon — now displays correctly at 256×256 (no more blurry icon in the installer)',
        ],
      },
    ],
  },
  {
    version: '0.2.0',
    date: 'May 28, 2026',
    sections: [
      {
        label: 'Internal',
        color: 'text-muted',
        items: [
          'Release Pipeline — set up automatic GitHub Releases and updates via Actions',
        ],
      },
    ],
  },
  {
    version: '0.1.0',
    date: 'May 28, 2026',
    sections: [
      {
        label: 'New',
        color: 'text-success',
        items: [
          'Anti-AFK — automatically prevents you from getting kicked for inactivity',
          'W-Hold — keeps W held down so you move forward without touching the keyboard',
          'Auto Clicker — clicks automatically for you, as fast and as often as you want',
          'Auto Key — presses any key automatically at a set interval',
          'Design — choose between light and dark theme',
          'Navigation — switch between tools with a single click',
          'System Tray — the app keeps running in the background when minimized',
          'Auto Updates — the app keeps itself up to date automatically',
        ],
      },
    ],
  },
]

export default memo(function PatchNotes({ onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm mx-4 rounded-lg bg-surface/8 backdrop-blur-xl border border-surface/12 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface/10">
          <span className="text-xs font-mono font-semibold tracking-widest uppercase text-muted/40">
            Patch Notes
          </span>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-md flex items-center justify-center text-muted/30 hover:text-muted/70 hover:bg-surface/10 transition-colors text-sm"
          >
            ×
          </button>
        </div>

        {/* Entries */}
        <div className="overflow-y-auto max-h-96 px-5 py-4 space-y-6">
          {ENTRIES.map((entry) => (
            <div key={entry.version}>
              {/* Version row */}
              <div className="flex items-baseline gap-3 mb-4">
                <span className="text-sm font-mono font-bold text-muted/80">
                  v{entry.version}
                </span>
                <span className="text-xs font-mono text-muted/30">{entry.date}</span>
              </div>

              {/* Sections */}
              {entry.sections.map((section) => (
                <div key={section.label} className="space-y-2">
                  <p className={`text-xs font-mono font-semibold uppercase tracking-wider ${section.color} opacity-70`}>
                    {section.label}
                  </p>
                  <ul className="space-y-1.5">
                    {section.items.map((item) => {
                      const [title, ...rest] = item.split(' — ')
                      return (
                        <li key={item} className="flex items-start gap-2.5 text-xs font-mono">
                          <span className="mt-px text-muted/20 shrink-0">▸</span>
                          <span className="text-muted/60 leading-relaxed">
                            {rest.length > 0 ? (
                              <>
                                <span className="text-muted/80">{title}</span>
                                {' — '}
                                {rest.join(' — ')}
                              </>
                            ) : (
                              title
                            )}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-surface/10 flex justify-end">
          <span className="text-xs font-mono text-muted/20">ESC to close</span>
        </div>
      </div>
    </div>
  )
})
