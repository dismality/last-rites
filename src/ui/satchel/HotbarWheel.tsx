import { useEffect } from 'react'
import { useGameStore } from '../../game/state/gameStore'
import { useInventoryStore } from '../../game/state/inventoryStore'
import { showItemName } from '../../game/state/itemNameStore'
import { cinematicActive, isMenuOpen } from '../../game/state/menuState'
import { isPlayLocked } from '../../scene/player/pointerLockOverride'
import { cycleHotbarSlot, hotbarItem } from '../../game/systems/satchel'

/** Wheel notches arrive in bursts; one slot per burst feels right. */
const WHEEL_COOLDOWN_MS = 120

/** Scroll wheel steps the hotbar during play (pointer locked) and shows the new item's name. Renders nothing. */
export function HotbarWheel() {
  useEffect(() => {
    let last = 0
    const onWheel = (e: WheelEvent) => {
      if (useGameStore.getState().screen !== 'game') return
      if (!isPlayLocked() || isMenuOpen() || cinematicActive()) return
      if (e.deltaY === 0) return
      const now = performance.now()
      if (now - last < WHEEL_COOLDOWN_MS) return
      const inv = useInventoryStore.getState()
      const next = cycleHotbarSlot(inv.inventory, inv.equippedSlot, e.deltaY > 0 ? 1 : -1)
      if (next === null) return
      last = now
      inv.equipSlot(next)
      showItemName(hotbarItem(inv.inventory, next))
    }
    window.addEventListener('wheel', onWheel, { passive: true })
    return () => window.removeEventListener('wheel', onWheel)
  }, [])
  return null
}
