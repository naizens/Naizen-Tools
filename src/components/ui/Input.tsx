import { forwardRef, InputHTMLAttributes } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement>

const Input = forwardRef<HTMLInputElement, Props>(function Input({ className = '', ...props }, ref) {
  return (
    <input
      ref={ref}
      className={`w-full bg-surface/10 border border-surface/15 rounded-md px-3 h-9 text-xs font-mono text-muted/70 focus:outline-none focus:border-accent/40 placeholder:text-muted/30 disabled:opacity-50 ${className}`}
      {...props}
    />
  )
})

export default Input
