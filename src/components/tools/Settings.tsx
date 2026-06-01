import { memo, useEffect } from 'react'
import { X } from 'lucide-react'
import { useToolStore } from '@/store/toolStore'

interface Props {
  onClose: () => void
}

export default memo(function Settings({ onClose }: Props) {
  const theme    = useToolStore((s) => s.theme)
  const setTheme = useToolStore((s) => s.setTheme)
  const autostart      = useToolStore((s) => s.autostart)
  const setAutostart   = useToolStore((s) => s.setAutostart)
  const closeAction    = useToolStore((s) => s.closeAction)
  const setCloseAction = useToolStore((s) => s.setCloseAction)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  function toggleCloseAction() {
    const next = closeAction === 'minimize' ? 'quit' : 'minimize'
    setCloseAction(next)
    window.api.setCloseAction(next)
  }

  function toggleAutostart() {
    if (autostart === null) return
    const next = !autostart
    setAutostart(next)
    window.api.setAutostart(next).catch(() => setAutostart(autostart))
  }

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
            Settings
          </span>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-md flex items-center justify-center text-muted/30 hover:text-muted/70 hover:bg-surface/10 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-4">
          {/* Autostart */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-mono font-semibold text-muted/70">Autostart</p>
              <p className="text-xs font-mono text-muted/30 mt-0.5">Launch on Windows startup</p>
            </div>
            <button
              onClick={toggleAutostart}
              disabled={autostart === null}
              className={[
                'relative w-11 h-6 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
                autostart ? 'bg-accent/30' : 'bg-muted/20',
              ].join(' ')}
              title="Toggle autostart"
            >
              <span
                className={[
                  'absolute top-1 w-4 h-4 rounded-full transition-all',
                  autostart ? 'left-6 bg-accent' : 'left-1 bg-muted/50',
                ].join(' ')}
              />
            </button>
          </div>

          {/* Close action */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-mono font-semibold text-muted/70">Close button</p>
              <p className="text-xs font-mono text-muted/30 mt-0.5">
                {closeAction === 'minimize' ? 'Minimizes to tray' : 'Quits the app'}
              </p>
            </div>
            <button
              onClick={toggleCloseAction}
              className={[
                'relative w-11 h-6 rounded-full transition-colors',
                closeAction === 'minimize' ? 'bg-accent/30' : 'bg-muted/20',
              ].join(' ')}
              title="Toggle close behavior"
            >
              <span
                className={[
                  'absolute top-1 w-4 h-4 rounded-full transition-all',
                  closeAction === 'minimize' ? 'left-6 bg-accent' : 'left-1 bg-muted/50',
                ].join(' ')}
              />
            </button>
          </div>

          {/* Theme */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-mono font-semibold text-muted/70">Theme</p>
              <p className="text-xs font-mono text-muted/30 mt-0.5">Light or dark appearance</p>
            </div>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={[
                'relative w-11 h-6 rounded-full transition-colors',
                theme === 'dark' ? 'bg-accent/30' : 'bg-muted/20',
              ].join(' ')}
              title="Toggle theme"
            >
              <span
                className={[
                  'absolute top-1 w-4 h-4 rounded-full transition-all',
                  theme === 'dark' ? 'left-6 bg-accent' : 'left-1 bg-muted/50',
                ].join(' ')}
              />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-surface/10 flex justify-end">
          <span className="text-xs font-mono text-muted/20">ESC to close</span>
        </div>
      </div>
    </div>
  )
})
