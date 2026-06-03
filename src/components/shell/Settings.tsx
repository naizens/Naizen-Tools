import { memo } from 'react'
import { useToolStore } from '@/store/toolStore'
import Modal from '@/components/ui/Modal'
import Toggle from '@/components/ui/Toggle'

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
    <Modal
      title="Settings"
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between w-full">
          <button
            onClick={() => {
              setTheme('dark')
              setCloseAction('minimize')
              window.api.setCloseAction('minimize')
              if (autostart !== false) {
                setAutostart(false)
                window.api.setAutostart(false).catch(() => {})
              }
            }}
            className="text-xs font-mono text-muted/25 hover:text-muted/50 transition-colors"
          >
            Reset to defaults
          </button>
          <span className="text-xs font-mono text-muted/20">ESC to close</span>
        </div>
      }
    >
      <div className="px-5 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-mono font-semibold text-muted/70">Autostart</p>
            <p className="text-xs font-mono text-muted/30 mt-0.5">Launch on Windows startup</p>
          </div>
          <Toggle value={!!autostart} onChange={toggleAutostart} disabled={autostart === null} />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-mono font-semibold text-muted/70">Close button</p>
            <p className="text-xs font-mono text-muted/30 mt-0.5">
              {closeAction === 'minimize' ? 'Minimizes to tray' : 'Quits the app'}
            </p>
          </div>
          <Toggle value={closeAction === 'minimize'} onChange={toggleCloseAction} />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-mono font-semibold text-muted/70">Theme</p>
            <p className="text-xs font-mono text-muted/30 mt-0.5">Light or dark appearance</p>
          </div>
          <Toggle value={theme === 'dark'} onChange={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
        </div>
      </div>
    </Modal>
  )
})
