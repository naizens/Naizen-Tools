import { memo, useEffect } from 'react'
import { ChevronRight, X } from 'lucide-react'

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
    version: '0.9.0',
    date: 'June 3, 2026',
    sections: [
      {
        label: 'New',
        color: 'text-success',
        items: [
          'Monitor Tool — change resolution and refresh rate per monitor from within the app',
          'Monitor Map — visual layout showing relative monitor positions, click to select',
          'Presets — one-click Desktop (2560×1440) and iRacing (1920×1080) modes for all monitors, with active indicator',
          'App Icon — new custom icon across the app, titlebar, tray, and installer',
        ],
      },
      {
        label: 'Improved',
        color: 'text-accent',
        items: [
          'Config Editor — line numbers with pixel-perfect alignment',
          'Config Editor — search highlighting shows all matches, active match in accent color',
          'Config Profiles — edit and delete buttons always visible in profile list',
          'Screenshot Gallery — delete screenshots directly from the gallery',
          'Screenshot Gallery — date and time shown on each thumbnail',
          'Screenshot Preview — loads full-resolution image, resolution badge top-right',
          'Screenshot Preview — scales correctly on maximized windows',
        ],
      },
      {
        label: 'Fixed',
        color: 'text-warn',
        items: [
          '8K Screenshot — crop no longer crashes when capture resolution is lower than target',
        ],
      },
    ],
  },
  {
    version: '0.8.0',
    date: 'June 2, 2026',
    sections: [
      {
        label: 'New',
        color: 'text-success',
        items: [
          'Config Profiles — save sets of iRacing .ini files (app.ini, rendererDX11.ini, …) and switch them all at once',
          'Save current — snapshot the live config, pick which files to include',
          'Apply — restore a saved profile over the live config with one click',
        ],
      },
    ],
  },
  {
    version: '0.7.0',
    date: 'June 2, 2026',
    sections: [
      {
        label: 'New',
        color: 'text-success',
        items: [
          'App Hub — card-based app manager with START / RUNNING / NOT FOUND states',
          'Profiles — separate app sets for sprint, endurance, or shared rigs',
          'Auto start/stop — trigger apps on iRacing Sim or iRacing UI launch/close, independently',
          'Per-app options — start hidden, include in Start All / Stop All',
          'Start All / Stop All — bulk control respecting each app’s include flags',
        ],
      },
    ],
  },
  {
    version: '0.6.1',
    date: 'June 2, 2026',
    sections: [
      {
        label: 'New',
        color: 'text-success',
        items: [
          'App icons — configured apps now show their executable icon',
          'Start All / Stop All — launch or stop all enabled apps at once',
        ],
      },
      {
        label: 'Fixed',
        color: 'text-warn',
        items: [
          'App status — running state is now detected from the OS process list, so launcher apps are tracked correctly',
          'Admin apps — apps requiring elevation now launch via a UAC prompt instead of crashing',
        ],
      },
    ],
  },
  {
    version: '0.6.0',
    date: 'June 2, 2026',
    sections: [
      {
        label: 'New',
        color: 'text-success',
        items: [
          'App Launcher — auto-start your overlays and tools when iRacing launches, and close them when you exit',
        ],
      },
    ],
  },
  {
    version: '0.5.2',
    date: 'June 2, 2026',
    sections: [
      {
        label: 'New',
        color: 'text-success',
        items: [
          'Screenshot layout — left sidebar with controls, large preview, horizontal thumbnail strip',
          'Window size — default is now 1280 × 720',
        ],
      },
    ],
  },
  {
    version: '0.5.1',
    date: 'June 2, 2026',
    sections: [
      {
        label: 'Fixed',
        color: 'text-warn',
        items: [
          'Screenshot hotkey — now uses Electron globalShortcut directly (Control+PrintScreen works correctly)',
          'iRacing SDK — fixed constructor crash on startup',
        ],
      },
      {
        label: 'New',
        color: 'text-success',
        items: [
          'Screenshot gallery — view and browse all saved screenshots with thumbnail preview',
          'Crop mode — choose between center crop (default) or top-left crop',
          'Manual restore — option to skip auto window-restore if it causes issues',
          'Error log — screenshot errors are written to userData/screenshot-errors.log',
          'Dimension retry — re-acquires capture stream until dimensions match (up to 8s)',
        ],
      },
    ],
  },
  {
    version: '0.5.0',
    date: 'June 2, 2026',
    sections: [
      {
        label: 'New',
        color: 'text-success',
        items: [
          'iRacing Screenshot — take high-res screenshots (up to 8K) with automatic watermark crop',
          'iRacing tab — Macros and iRacing tools now have their own nav dropdowns',
          'Filename tokens — customizable filename with track, driver, car, lap, date and more',
          'Output format — choose between JPEG, PNG, or WebP',
        ],
      },
    ],
  },
  {
    version: '0.4.7',
    date: 'June 1, 2026',
    sections: [
      {
        label: 'Improved',
        color: 'text-accent',
        items: [
          'Theme — toggle moved to Settings, removed from the title bar',
          'Update — restart button is now a proper visible button',
        ],
      },
    ],
  },
  {
    version: '0.4.6',
    date: 'June 1, 2026',
    sections: [
      {
        label: 'New',
        color: 'text-success',
        items: [
          'Window state — size, position, and maximized state are remembered across restarts',
          'Multi-monitor — the app reopens on the same screen it was closed on',
        ],
      },
    ],
  },
  {
    version: '0.4.5',
    date: 'June 1, 2026',
    sections: [
      {
        label: 'Improved',
        color: 'text-accent',
        items: [
          'Close button — new setting to choose between minimizing to tray or quitting the app',
          'Language — all UI text is now in English',
        ],
      },
    ],
  },
  {
    version: '0.4.4',
    date: 'June 1, 2026',
    sections: [
      {
        label: 'Improved',
        color: 'text-accent',
        items: [
          'Version number — click it in the title bar to open patch notes',
        ],
      },
    ],
  },
  {
    version: '0.4.3',
    date: 'June 1, 2026',
    sections: [
      {
        label: 'Fixed',
        color: 'text-warn',
        items: [
          'Auto Update — rewritten to match proven pattern; only fires when download is complete, no timing issues',
        ],
      },
    ],
  },
  {
    version: '0.4.2',
    date: 'June 1, 2026',
    sections: [
      {
        label: 'Fixed',
        color: 'text-warn',
        items: [
          'Auto Update — check now waits for the window to finish loading, so update notifications are never missed',
        ],
      },
    ],
  },
  {
    version: '0.4.1',
    date: 'June 1, 2026',
    sections: [
      {
        label: 'Fixed',
        color: 'text-warn',
        items: [
          'Auto Update — now uses app.isPackaged for a reliable check; downloads automatically in the background',
        ],
      },
    ],
  },
  {
    version: '0.4.0',
    date: 'June 1, 2026',
    sections: [
      {
        label: 'New',
        color: 'text-success',
        items: [
          'Settings — gear icon in the title bar opens a settings modal',
          'Autostart — launch the app automatically when Windows starts',
        ],
      },
      {
        label: 'Improved',
        color: 'text-accent',
        items: [
          'Icons — all icons are now Lucide for a consistent look',
        ],
      },
      {
        label: 'Fixed',
        color: 'text-warn',
        items: [
          'Tray Icon — no longer crashes when the app is minimized',
        ],
      },
    ],
  },
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
            className="w-6 h-6 rounded-md flex items-center justify-center text-muted/30 hover:text-muted/70 hover:bg-surface/10 transition-colors"
          >
            <X size={14} />
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
                        <li key={item} className="flex items-start gap-1.5 text-xs font-mono">
                          <ChevronRight size={12} className="mt-px text-muted/20 shrink-0" />
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
