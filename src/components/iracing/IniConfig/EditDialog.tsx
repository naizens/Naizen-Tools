import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import SharedModal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import { sourceName, type IniProfile } from './types'

interface Props {
  profile: IniProfile
  onClose: () => void
  onSaved: (msg: string) => void
}

export default function EditDialog({ profile, onClose, onSaved }: Props) {
  const [name, setName] = useState(profile.name)

  const save = async () => {
    if (!name.trim()) return
    await window.api.iniRename(profile.id, name.trim())
    onSaved(`Renamed to "${name.trim()}"`)
  }

  return (
    <SharedModal title="Edit Profile" onClose={onClose} width="max-w-md" footer={
      <div className="flex items-center justify-end gap-2 w-full">
        <button onClick={async () => { await window.api.iniDelete(profile.id); onSaved('Deleted profile') }}
          className="mr-auto flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono text-warn/60 hover:text-warn hover:bg-warn/10 transition-colors">
          <Trash2 size={12} /> Delete
        </button>
        <button onClick={onClose} className="px-4 py-1.5 rounded-md border border-surface/15 text-xs font-mono text-muted/50 hover:text-muted/80 hover:bg-surface/10 transition-colors">Cancel</button>
        <button onClick={save} disabled={!name.trim()}
          className="px-4 py-1.5 rounded-md bg-accent/20 border border-accent/30 text-xs font-mono font-semibold text-accent hover:bg-accent/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">Save</button>
      </div>
    }>
      <div className="p-5 space-y-4">
        <div>
          <p className="text-xs font-mono text-muted/40 mb-1">Profile name</p>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
          <p className="text-xs font-mono text-muted/25 mt-1">Renaming keeps the existing source files.</p>
        </div>
        <div className="bg-surface/10 rounded-md px-3 py-2.5 space-y-1.5">
          <p className="text-xs font-mono text-muted/40">Swaps these files:</p>
          {profile.files.map((target) => (
            <p key={target} className="text-xs font-mono text-muted/60 flex items-center gap-1.5">
              <span className="text-accent/60">{sourceName(target, profile.slug)}</span>
              <span className="text-muted/25">→</span>
              <span>{target}</span>
            </p>
          ))}
        </div>
      </div>
    </SharedModal>
  )
}
