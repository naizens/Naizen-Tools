import { useState } from 'react'
import { Check } from 'lucide-react'
import SharedModal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'

interface Props {
  allFiles: string[]
  managedFiles: string[]
  onClose: () => void
  onSave: (files: string[]) => void
}

export default function ManagedFilesModal({ allFiles, managedFiles, onClose, onSave }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(managedFiles))
  const [custom, setCustom]     = useState('')

  const toggle = (f: string) => setSelected((prev) => {
    const next = new Set(prev); next.has(f) ? next.delete(f) : next.add(f); return next
  })

  const addCustom = () => {
    const f = custom.trim()
    if (!f || selected.has(f)) return
    setSelected((prev) => new Set([...prev, f]))
    setCustom('')
  }

  const allOptions = [...new Set([...allFiles, ...managedFiles])].sort((a, b) => a.localeCompare(b))

  return (
    <SharedModal title="Managed Files" onClose={onClose} width="max-w-md" footer={
      <div className="flex items-center justify-end gap-2 w-full">
        <button onClick={onClose} className="px-4 py-1.5 rounded-md border border-surface/15 text-xs font-mono text-muted/50 hover:text-muted/80 hover:bg-surface/10 transition-colors">Cancel</button>
        <button onClick={() => onSave([...selected])}
          className="px-4 py-1.5 rounded-md bg-accent/20 border border-accent/30 text-xs font-mono font-semibold text-accent hover:bg-accent/30 transition-colors">Save</button>
      </div>
    }>
      <div className="p-5 space-y-4">
        <p className="text-xs font-mono text-muted/40">Choose which files all profiles will capture and swap.</p>
        <div className="space-y-1 rounded-md border border-surface/10 p-1.5 max-h-52 overflow-y-auto">
          {allOptions.map((f) => (
            <label key={f} onClick={() => toggle(f)} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-surface/10 cursor-pointer">
              <span className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${selected.has(f) ? 'bg-accent/30 border-accent/40' : 'border-surface/20'}`}>
                {selected.has(f) && <Check size={10} className="text-accent" />}
              </span>
              <span className="text-xs font-mono text-muted/60 truncate">{f}</span>
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <Input value={custom} onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addCustom() }}
            placeholder="Add file not in list… (e.g. custom.ini)"
            className="h-8" />
          <button onClick={addCustom} className="px-3 h-8 rounded-md border border-surface/15 text-xs font-mono text-muted/50 hover:text-muted/80 hover:bg-surface/10 transition-colors">Add</button>
        </div>
      </div>
    </SharedModal>
  )
}
