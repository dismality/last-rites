// Mounts the open Minigame overlay (spec 10 task 3.2 onward). One flag in `overlayStore` says which.
// Minigame 1b has no overlay: its bell cords are pulled in the world and its question is in the journal.
// Case 3's 3b (the pin) and 3c (Elias) happen in the world, and 3d (the handwriting) is in the journal.
import { useOverlayStore } from '../../game/state/overlayStore'
import { BootPrintsMinigame } from './BootPrintsMinigame'
import { CrestLockMinigame } from './CrestLockMinigame'
import { HymnMinigame } from './HymnMinigame'
import { LedgerMinigame } from './LedgerMinigame'
import { RegisterMinigame } from './RegisterMinigame'
import { WatchLogMinigame } from './WatchLogMinigame'

export function MinigameHost() {
  const open = useOverlayStore((s) => s.minigameOpen)
  switch (open) {
    case '1a':
      return <LedgerMinigame />
    case '2a':
      return <RegisterMinigame />
    case '2b':
      return <WatchLogMinigame />
    case '2c':
      return <BootPrintsMinigame />
    case '2d':
      return <CrestLockMinigame />
    case '3a':
      return <HymnMinigame />
    default:
      return null
  }
}
