import { Info, Minus, Settings, Square, X } from 'lucide-react'
import iconSrc from '../../../assets/icon.png'

interface Props {
  onPatchNotes: () => void
  onSettings: () => void
  onAbout: () => void
  onClose: () => void
}

export default function TitleBar({ onPatchNotes, onSettings, onAbout, onClose }: Props) {

  return (
    <div className="drag flex items-center justify-between h-10 px-4 shrink-0 border-b border-surface/10">
      <div className="no-drag flex items-center gap-2">
        <img src={iconSrc} alt="icon" className="w-5 h-5 rounded-sm" />
        <span className="text-xs font-mono font-semibold text-muted/40 tracking-widest uppercase">
          Naizen Tools
        </span>
        <button
          onClick={onPatchNotes}
          className="text-xs font-mono text-muted/20 hover:text-muted/50 transition-colors"
          title="Patch Notes"
        >
          v{__APP_VERSION__}
        </button>
      </div>
      <div className="no-drag flex items-center gap-1">
        <button
          onClick={onAbout}
          className="w-7 h-7 rounded-md flex items-center justify-center text-muted/40 hover:text-muted/80 hover:bg-surface/10 transition-colors"
          title="About"
        >
          <Info size={14} />
        </button>
        <button
          onClick={onSettings}
          className="w-7 h-7 rounded-md flex items-center justify-center text-muted/40 hover:text-muted/80 hover:bg-surface/10 transition-colors"
          title="Settings"
        >
          <Settings size={14} />
        </button>
        <button
          onClick={() => window.api.windowMinimize()}
          className="w-7 h-7 rounded-md flex items-center justify-center text-muted/40 hover:text-muted/80 hover:bg-surface/10 transition-colors"
          title="Minimize"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={() => window.api.windowMaximize()}
          className="w-7 h-7 rounded-md flex items-center justify-center text-muted/40 hover:text-muted/80 hover:bg-surface/10 transition-colors"
          title="Maximize"
        >
          <Square size={12} />
        </button>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-md flex items-center justify-center text-muted/40 hover:text-warn hover:bg-warn/10 transition-colors"
          title="Close"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  )
}
