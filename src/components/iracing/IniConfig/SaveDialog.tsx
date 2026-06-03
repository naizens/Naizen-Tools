import { useState } from 'react'
import { FileText } from 'lucide-react'
import SharedModal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import type { IniProfile } from './types'

interface Props {
  folder: string
  managedFiles: string[]
  existing: IniProfile[]
  onClose: () => void
  onSaved: (msg: string, id?: string) => void
}

export default function SaveDialog({ folder, managedFiles, existing, onClose, onSaved }: Props) {
  const [name, setName] = useState('')

  const save = async () => {
    if (!name.trim()) return
    const p = await window.api.iniCreate({ name: name.trim(), folder, managedFiles })
    onSaved(`Saved "${name.trim()}"`, p.id)
  }

  const nameExists = existing.some((p) => p.name.toLowerCase() === name.trim().toLowerCase())

  return (
    <SharedModal title="New Config Profile" onClose={onClose} width="max-w-md" footer={
      <div className="flex items-center justify-end gap-2 w-full">
        <button onClick={onClose} className="px-4 py-1.5 rounded-md border border-surface/15 text-xs font-mono text-muted/50 hover:text-muted/80 hover:bg-surface/10 transition-colors">Cancel</button>
        <button onClick={save} disabled={!name.trim()}
          className="px-4 py-1.5 rounded-md bg-accent/20 border border-accent/30 text-xs font-mono font-semibold text-accent hover:bg-accent/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">Save</button>
      </div>
    }>
      <div className="p-5 space-y-4">
        <div>
          <p className="text-xs font-mono text-muted/40 mb-1">Profile name</p>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save() }}
            placeholder="e.g. Triple 1440p, Triple 1080p, Screenshot" />
          {nameExists && <p className="text-xs font-mono text-amber/60 mt-1">A profile with this name already exists</p>}
        </div>
        <div className="bg-surface/10 rounded-md px-3 py-2.5 space-y-1">
          <p className="text-xs font-mono text-muted/40 mb-1">Captures a copy of:</p>
          {managedFiles.map((f) => (
            <p key={f} className="text-xs font-mono text-muted/60 flex items-center gap-2">
              <FileText size={10} className="text-accent/50" /> {f}
            </p>
          ))}
        </div>
      </div>
    </SharedModal>
  )
}
