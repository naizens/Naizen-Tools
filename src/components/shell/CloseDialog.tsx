import { ArrowRight, X } from 'lucide-react'
import { useState } from 'react'
import { useToolStore } from '@/store/toolStore'

interface Props {
  onClose: () => void
}

export default function CloseDialog({ onClose }: Props) {
  const setCloseAction        = useToolStore((s) => s.setCloseAction)
  const setRememberCloseAction = useToolStore((s) => s.setRememberCloseAction)
  const [remember, setRemember] = useState(false)

  function choose(action: 'minimize' | 'quit') {
    if (remember) {
      setCloseAction(action)
      setRememberCloseAction(true)
      window.api.setCloseAction(action)
    }
    if (action === 'minimize') {
      window.api.windowHide()
    } else {
      window.api.windowQuit()
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-72 rounded-lg bg-surface/8 backdrop-blur-xl border border-surface/12 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface/10">
          <span className="text-xs font-mono font-semibold text-muted/60">Close Window</span>
          <button onClick={onClose} className="w-6 h-6 rounded-md flex items-center justify-center text-muted/30 hover:text-muted/70 hover:bg-surface/10 transition-colors">
            <X size={12} />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 pt-4 pb-2">
          <p className="text-xs font-mono text-muted/50 mb-3">What would you like to do?</p>

          <div className="space-y-1">
            <button
              onClick={() => choose('minimize')}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-xs font-mono text-muted/70 hover:text-muted/90 hover:bg-surface/10 transition-colors text-left"
            >
              <ArrowRight size={13} className="text-accent shrink-0" />
              Minimize to Tray
            </button>
            <button
              onClick={() => choose('quit')}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-xs font-mono text-muted/70 hover:text-muted/90 hover:bg-surface/10 transition-colors text-left"
            >
              <ArrowRight size={13} className="text-accent shrink-0" />
              Quit App
            </button>
          </div>
        </div>

        {/* Remember */}
        <div className="px-4 py-3 border-t border-surface/10 mt-2">
          <label className="flex items-center gap-2 cursor-pointer group">
            <div
              onClick={() => setRemember(v => !v)}
              className={[
                'w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors shrink-0',
                remember ? 'bg-accent/30 border-accent/60' : 'border-surface/30 group-hover:border-surface/50',
              ].join(' ')}
            >
              {remember && <div className="w-2 h-2 rounded-sm bg-accent" />}
            </div>
            <span className="text-xs font-mono text-muted/40 group-hover:text-muted/60 transition-colors">
              Remember my choice
            </span>
          </label>
        </div>
      </div>
    </div>
  )
}
