import { Moon, Minus, ScrollText, Settings, Square, Sun, X } from 'lucide-react'
import { useToolStore } from '@/store/toolStore'

interface Props {
  onPatchNotes: () => void
  onSettings: () => void
}

export default function TitleBar({ onPatchNotes, onSettings }: Props) {
  const theme = useToolStore((s) => s.theme)
  const setTheme = useToolStore((s) => s.setTheme)

  return (
    <div className="drag flex items-center justify-between h-10 px-4 shrink-0 border-b border-surface/10">
      <div className="no-drag flex items-baseline gap-2">
        <span className="text-xs font-mono font-semibold text-muted/40 tracking-widest uppercase">
          Naizen Tools
        </span>
        <span className="text-xs font-mono text-muted/20">v{__APP_VERSION__}</span>
      </div>
      <div className="no-drag flex items-center gap-1">
        <button
          onClick={onSettings}
          className="w-7 h-7 rounded-md flex items-center justify-center text-muted/40 hover:text-muted/80 hover:bg-surface/10 transition-colors"
          title="Einstellungen"
        >
          <Settings size={14} />
        </button>
        <button
          onClick={onPatchNotes}
          className="w-7 h-7 rounded-md flex items-center justify-center text-muted/40 hover:text-muted/80 hover:bg-surface/10 transition-colors"
          title="Patch Notes"
        >
          <ScrollText size={14} />
        </button>
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="w-7 h-7 rounded-md flex items-center justify-center text-muted/40 hover:text-muted/80 hover:bg-surface/10 transition-colors"
          title="Theme wechseln"
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>
        <button
          onClick={() => window.api.windowMinimize()}
          className="w-7 h-7 rounded-md flex items-center justify-center text-muted/40 hover:text-muted/80 hover:bg-surface/10 transition-colors"
          title="Minimieren"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={() => window.api.windowMaximize()}
          className="w-7 h-7 rounded-md flex items-center justify-center text-muted/40 hover:text-muted/80 hover:bg-surface/10 transition-colors"
          title="Maximieren"
        >
          <Square size={12} />
        </button>
        <button
          onClick={() => window.api.windowClose()}
          className="w-7 h-7 rounded-md flex items-center justify-center text-muted/40 hover:text-warn hover:bg-warn/10 transition-colors"
          title="Close"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  )
}
