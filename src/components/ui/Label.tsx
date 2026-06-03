import { ReactNode } from 'react'

interface Props {
  children: ReactNode
  className?: string
}

export default function Label({ children, className = '' }: Props) {
  return (
    <p className={`text-xs font-mono text-muted/30 uppercase tracking-wider ${className}`}>
      {children}
    </p>
  )
}
