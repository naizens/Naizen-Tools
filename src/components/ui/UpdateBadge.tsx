import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'

export default function UpdateBadge() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    return window.api.onUpdateDownloaded(() => setReady(true))
  }, [])

  if (!ready) return null

  return (
    <div className="bg-amber/10 border-b border-amber/20 px-5 py-2.5 flex items-center justify-between gap-4">
      <span className="text-xs font-mono text-amber/80">Update downloaded</span>
      <button
        onClick={() => window.api.updateInstall()}
        className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-amber hover:text-amber/70 transition-colors shrink-0"
      >
        Restart now <ArrowRight size={12} />
      </button>
    </div>
  )
}
