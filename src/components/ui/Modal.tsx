import { ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: string
}

export default function Modal({ title, onClose, children, footer, width = 'max-w-sm' }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`relative w-full ${width} mx-4 rounded-lg bg-surface/8 backdrop-blur-xl border border-surface/12 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface/10 shrink-0">
          <span className="text-xs font-mono font-semibold tracking-widest uppercase text-muted/40">{title}</span>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-md flex items-center justify-center text-muted/30 hover:text-muted/70 hover:bg-surface/10 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-5 py-3 border-t border-surface/10 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
