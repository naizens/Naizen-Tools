import { useToolStore } from '@/store/toolStore'

interface Props {
  onPatchNotes: () => void
}

export default function TitleBar({ onPatchNotes }: Props) {
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
          onClick={onPatchNotes}
          className="w-7 h-7 rounded-md flex items-center justify-center text-muted/40 hover:text-muted/80 hover:bg-surface/10 transition-colors"
          title="Patch Notes"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="2" y1="4" x2="12" y2="4"/>
            <line x1="2" y1="7" x2="12" y2="7"/>
            <line x1="2" y1="10" x2="9"  y2="10"/>
          </svg>
        </button>
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="w-7 h-7 rounded-md flex items-center justify-center text-muted/40 hover:text-muted/80 hover:bg-surface/10 transition-colors"
          title="Theme wechseln"
        >
          {theme === 'dark' ? (
            /* Sonne – im Dark Mode anzeigen um zu Light zu wechseln */
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="7" cy="7" r="2.5"/>
              <line x1="7" y1="1"   x2="7"   y2="2.5"/>
              <line x1="7" y1="11.5" x2="7"  y2="13"/>
              <line x1="1"   y1="7" x2="2.5" y2="7"/>
              <line x1="11.5" y1="7" x2="13" y2="7"/>
              <line x1="2.93" y1="2.93" x2="3.99" y2="3.99"/>
              <line x1="10.01" y1="10.01" x2="11.07" y2="11.07"/>
              <line x1="11.07" y1="2.93" x2="10.01" y2="3.99"/>
              <line x1="3.99" y1="10.01" x2="2.93" y2="11.07"/>
            </svg>
          ) : (
            /* Mond – im Light Mode anzeigen um zu Dark zu wechseln */
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11.5 9A5 5 0 0 1 5 2.5a5 5 0 1 0 6.5 6.5z"/>
            </svg>
          )}
        </button>
        <button
          onClick={() => window.api.windowMinimize()}
          className="w-7 h-7 rounded-md flex items-center justify-center text-muted/40 hover:text-muted/80 hover:bg-surface/10 transition-colors"
          title="Minimieren"
        >
          <svg width="14" height="2" viewBox="0 0 14 2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="1" y1="1" x2="13" y2="1"/>
          </svg>
        </button>
        <button
          onClick={() => window.api.windowMaximize()}
          className="w-7 h-7 rounded-md flex items-center justify-center text-muted/40 hover:text-muted/80 hover:bg-surface/10 transition-colors"
          title="Maximieren"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="1" width="10" height="10" rx="1"/>
          </svg>
        </button>
        <button
          onClick={() => window.api.windowClose()}
          className="w-7 h-7 rounded-md flex items-center justify-center text-muted/40 hover:text-warn hover:bg-warn/10 transition-colors"
          title="Close"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="1" y1="1" x2="11" y2="11"/>
            <line x1="11" y1="1" x2="1"  y2="11"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
