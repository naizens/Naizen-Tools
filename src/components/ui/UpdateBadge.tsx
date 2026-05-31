import { useToolStore } from '@/store/toolStore'

export default function UpdateBadge() {
  const updateDownloading = useToolStore((s) => s.updateDownloading)
  const updateReady       = useToolStore((s) => s.updateReady)

  return (
    <div className="bg-amber/10 border-b border-amber/20 px-5 py-2.5 flex items-center justify-between gap-4">
      <span className={[
        'text-xs font-mono text-amber/80',
        !updateDownloading && !updateReady ? 'animate-pulse' : '',
      ].join(' ')}>
        {updateReady
          ? '● Update downloaded'
          : updateDownloading
            ? '● Downloading…'
            : 'New update available'}
      </span>

      {updateReady ? (
        <button
          onClick={() => window.api.updateInstall()}
          className="text-xs font-mono font-semibold text-amber hover:text-amber/70 transition-colors shrink-0"
        >
          Restart now →
        </button>
      ) : !updateDownloading ? (
        <button
          onClick={() => window.api.updateDownload()}
          className="shrink-0 px-3 py-1 rounded-md bg-amber/20 border border-amber/30 text-xs font-mono font-semibold text-amber hover:bg-amber/30 transition-colors"
        >
          Install now
        </button>
      ) : null}
    </div>
  )
}
