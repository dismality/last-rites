// Mounts the open Minigame overlay (spec 10 task 3.2 onward). One flag in `overlayStore` says which.
import { useOverlayStore } from '../../game/state/overlayStore'
import { BellsMinigame } from './BellsMinigame'
import { BootPrintsMinigame } from './BootPrintsMinigame'
import { CrestLockMinigame } from './CrestLockMinigame'
import { HymnMinigame } from './HymnMinigame'
import { LedgerMinigame } from './LedgerMinigame'
import { TimelineMinigame } from './TimelineMinigame'
import { WatchLogMinigame } from './WatchLogMinigame'

export function MinigameHost() {
  const open = useOverlayStore((s) => s.minigameOpen)
  switch (open) {
    case '1a':
      return <LedgerMinigame />
    case '1b':
      return <BellsMinigame />
    case '2a':
      return <CrestLockMinigame />
    case '2b':
      return <WatchLogMinigame />
    case '2c':
      return <BootPrintsMinigame />
    case '3a':
      return <HymnMinigame />
    case '3b':
      return <TimelineMinigame />
    default:
      return null
  }
}
