import { ArrowRight, Circle } from 'lucide-react'
import { useToolStore } from '@/store/toolStore'

export default function UpdateBadge() {
  const updateDownloading = useToolStore((s) => s.updateDownloading)
  const updateReady       = useToolStore((s) => s.updateReady)

  return (
    <div className="bg-amber/10 border-b border-amber/20 px-5 py-2.5 flex items-center justify-between gap-4">
      <span className={[
        'inline-flex items-center gap-1.5 text-xs font-mono text-amber/80',
        !updateReady ? 'animate-pulse' : '',
      ].join(' ')}>
        {updateReady && <Circle size={7} fill="currentColor" strokeWidth={0} />}
        {updateReady ? 'Update downloaded' : 'Downloading update…'}
      </span>

      {updateReady && (
        <button
          onClick={() => window.api.updateInstall()}
          className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-amber hover:text-amber/70 transition-colors shrink-0"
        >
          Restart now <ArrowRight size={12} />
        </button>
      )}
    </div>
  )
}
