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
    version: '0.1.0',
    date: '28. Mai 2026',
    sections: [
      {
        label: 'Neu',
        color: 'text-success',
        items: [
          'Anti-AFK — D/A Tasten automatisch drücken',
          'W-Hold — W-Taste dauerhaft gedrückt halten',
          'Auto-Klicker — Maustaste automatisch klicken',
          'Auto-Taste — Beliebige Taste automatisch drücken',
          'Dark / Light Mode',
          'Navbar mit Tab-Wechsel',
          'System Tray',
          'Auto-Updater via GitHub Releases',
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
          <span className="text-xs font-mono text-muted/20">ESC zum Schließen</span>
        </div>
      </div>
    </div>
  )
})
