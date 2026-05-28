import { ReactNode } from 'react'

interface Props {
  title?: string
  children: ReactNode
}

export default function Panel({ title, children }: Props) {
  return (
    <div className="rounded-lg bg-surface/5 backdrop-blur-md border border-surface/10 p-5">
      {title && (
        <p className="text-xs font-mono font-semibold text-muted/40 tracking-widest uppercase mb-4">
          {title}
        </p>
      )}
      {children}
    </div>
  )
}
