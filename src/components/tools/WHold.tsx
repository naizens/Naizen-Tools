import { memo, useCallback } from 'react'
import { useToolStore } from '@/store/toolStore'
import Panel from '@/components/ui/Panel'
import Button from '@/components/ui/Button'
import StatusBadge from '@/components/ui/StatusBadge'

export default memo(function WHold() {
  const running = useToolStore((s) => s.running.whold)

  const toggle = useCallback(() => {
    if (running) {
      window.api.stopTool('whold')
    } else {
      window.api.startTool('whold', {})
    }
  }, [running])

  return (
    <Panel title="W-Hold">
      <div className="flex items-center justify-between mb-4">
        <StatusBadge running={running} />
      </div>
      <Button variant={running ? 'danger' : 'primary'} onClick={toggle}>
        {running ? 'Stoppen' : 'Starten'}
      </Button>
    </Panel>
  )
})
