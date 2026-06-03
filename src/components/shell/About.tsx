import { memo, useState } from 'react'
import { ChevronDown, ExternalLink, GitBranch } from 'lucide-react'
import iconSrc from '../../../assets/icon.png'
import Modal from '@/components/ui/Modal'

const CREDITS: { category: string; items: { name: string; desc: string; url: string }[] }[] = [
  {
    category: 'Reference Apps',
    items: [
      { name: 'iracing-screenshot-tool', desc: 'High-res iRacing screenshots', url: 'https://github.com/svglol/iracing-screenshot-tool' },
      { name: 'irHub',                   desc: 'iRacing app hub & launcher',   url: 'https://github.com/Marijn17s/irHub' },
      { name: 'irsdk-node',              desc: 'iRacing SDK for Node.js',      url: 'https://github.com/bengsfort/irsdk-node' },
    ],
  },
  {
    category: 'Open Source Libraries',
    items: [
      { name: 'Electron',        desc: 'Cross-platform desktop apps',  url: 'https://github.com/electron/electron' },
      { name: 'React',           desc: 'UI framework',                 url: 'https://github.com/facebook/react' },
      { name: 'Tailwind CSS',    desc: 'Utility-first CSS framework',  url: 'https://github.com/tailwindlabs/tailwindcss' },
      { name: 'Zustand',         desc: 'State management',             url: 'https://github.com/pmndrs/zustand' },
      { name: 'Lucide',          desc: 'Icon library',                 url: 'https://github.com/lucide-icons/lucide' },
      { name: 'sharp',           desc: 'Image processing',             url: 'https://github.com/lovell/sharp' },
      { name: 'koffi',           desc: 'Native FFI bindings',          url: 'https://github.com/Koromix/koffi' },
      { name: 'uiohook-napi',    desc: 'Global input hooks',           url: 'https://github.com/SnosMe/uiohook-napi' },
      { name: 'nut-tree-fork',   desc: 'Desktop automation',           url: 'https://github.com/nut-tree-fork/nut.js' },
      { name: 'electron-builder',desc: 'App packaging & auto-update',  url: 'https://github.com/electron-userland/electron-builder' },
      { name: 'electron-vite',   desc: 'Build tooling for Electron',   url: 'https://github.com/alex8088/electron-vite' },
    ],
  },
]

interface Props {
  onClose: () => void
}

export default memo(function About({ onClose }: Props) {
  const [creditsOpen, setCreditsOpen] = useState(false)

  return (
    <Modal
      title="About"
      onClose={onClose}
      width="max-w-lg"
      footer={<span className="text-xs font-mono text-muted/20">ESC to close</span>}
    >
      <div className="px-5 py-5 space-y-5">
        {/* App identity */}
        <div className="flex items-center gap-3">
          <img src={iconSrc} alt="icon" className="w-12 h-12 rounded-xl shrink-0" />
          <div>
            <p className="text-sm font-mono font-bold text-muted/80">Naizen Tools</p>
            <p className="text-xs font-mono text-muted/30">v{__APP_VERSION__}</p>
            <p className="text-xs font-mono text-muted/40 mt-1 leading-relaxed">
              A desktop toolkit for gamers — macros, Anti-AFK,<br />monitor control and iRacing tools.
            </p>
          </div>
        </div>

        {/* Connect */}
        <div className="border-t border-surface/10 pt-4 space-y-2">
          <p className="text-xs font-mono font-semibold text-muted/30 uppercase tracking-wider mb-3">Connect</p>
          <a
            href="https://github.com/naizens/Naizen-Tools"
            onClick={(e) => { e.preventDefault(); window.open('https://github.com/naizens/Naizen-Tools') }}
            className="flex items-center gap-2.5 text-xs font-mono text-muted/50 hover:text-muted/80 transition-colors group cursor-pointer"
          >
            <GitBranch size={14} className="text-muted/30 group-hover:text-muted/60" />
            GitHub Repository
            <ExternalLink size={10} className="text-muted/20 group-hover:text-muted/40 ml-auto" />
          </a>
        </div>

        {/* Privacy */}
        <div className="border-t border-surface/10 pt-4">
          <p className="text-xs font-mono font-semibold text-muted/30 uppercase tracking-wider mb-3">Privacy</p>
          <p className="text-xs font-mono text-muted/40 leading-relaxed">
            Naizen Tools does not collect, store or transmit any personal data or usage analytics. All data stays on your machine.
          </p>
        </div>

        {/* Open Source Credits */}
        <div className="border-t border-surface/10 pt-4">
          <button
            onClick={() => setCreditsOpen(v => !v)}
            className="w-full flex items-center justify-between text-xs font-mono font-semibold text-muted/30 uppercase tracking-wider hover:text-muted/50 transition-colors"
          >
            Open Source Credits
            <ChevronDown size={13} className={`transition-transform ${creditsOpen ? 'rotate-180' : ''}`} />
          </button>

          {creditsOpen && (
            <div className="mt-4 space-y-4">
              {CREDITS.map(({ category, items }) => (
                <div key={category}>
                  <p className="text-[10px] font-mono font-semibold text-muted/25 uppercase tracking-widest mb-2">{category}</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {items.map(({ name, desc, url }) => (
                      <button
                        key={name}
                        onClick={() => window.open(url)}
                        className="text-left px-3 py-2 rounded-md border border-surface/10 bg-surface/5 hover:bg-surface/10 hover:border-surface/20 transition-colors group"
                      >
                        <p className="text-xs font-mono font-semibold text-muted/70 group-hover:text-muted/90 truncate">{name}</p>
                        <p className="text-[10px] font-mono text-muted/30 truncate">{desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
})
