import { SelectHTMLAttributes } from 'react'

type Props = SelectHTMLAttributes<HTMLSelectElement>

export default function Select({ className = '', ...props }: Props) {
  return (
    <select
      className={`w-full bg-app border border-surface/15 rounded-md px-3 h-9 text-xs font-mono text-muted/70 focus:outline-none focus:border-accent/40 [color-scheme:dark] ${className}`}
      {...props}
    />
  )
}
