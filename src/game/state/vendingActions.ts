// Vending machine glue (spec 11 H6): coins, stock, satchel and spend stats change together or not
// at all, and the coin clink or refusal buzz plays from the machine. Pure zustand glue, no React /
// three.js imports. The handle and tray sounds follow the machine's animation (VendingMachine.tsx).
import { VENDING_MACHINE } from '../../data/hutScenery'
import type { VendingRowId } from '../../data/vending'
import { subscribeToType } from '../events'
import { ownedGuns } from '../systems/elites'
import { recordCoins } from '../systems/runStats'
import { buy, resetAtDawn, visibleRows, withinVendingRange, type Refusal } from '../systems/vending'
import { emitCombatSound, type SoundPosition } from './combatSounds'
import { useCombatStore } from './combatStore'
import { currentModifiers } from './derivedStats'
import { useInventoryStore } from './inventoryStore'
import { useOverlayStore } from './overlayStore'
import { usePlayerStore } from './playerStore'
import { useProgressionStore } from './progressionStore'
import { updateRunStats } from './statsPort'
import { useVendingStore } from './vendingStore'

/** The machine's front, where its sounds come from. */
export const VENDING_SOUND_AT: SoundPosition = {
  x: VENDING_MACHINE.position[0],
  y: 1,
  z: VENDING_MACHINE.position[2],
}

/** Revolver and shotgun ownership, by the elite-drop rule (satchel or a tracked magazine). */
export function vendingOwnedGuns() {
  return ownedGuns(useInventoryStore.getState().inventory, useCombatStore.getState().firearms)
}

/** Buys one row. Returns the refusal, or null on success. */
export function buyFromVending(id: VendingRowId): Refusal | null {
  const shown = visibleRows(vendingOwnedGuns()).some((r) => r.id === id)
  if (!shown) {
    emitCombatSound('vending-refuse', VENDING_SOUND_AT)
    return { ok: false, reason: 'sold-out', text: 'Not sold here' }
  }
  const vend = useVendingStore.getState()
  const pr = useProgressionStore.getState()
  const inv = useInventoryStore.getState()
  const out = buy(id, vend.stock, pr.coins, inv.inventory, currentModifiers().satchelSlots)
  if (!out.result.ok) {
    emitCombatSound('vending-refuse', VENDING_SOUND_AT)
    return out.result
  }
  const row = out.result.row
  inv.setInventory(out.inv)
  pr.patch({ coins: out.coins })
  useVendingStore.setState({
    stock: out.state,
    lastPurchase: { row: row.id, handle: row.handle, seq: (vend.lastPurchase?.seq ?? 0) + 1 },
  })
  updateRunStats((s) => recordCoins(s, 0, row.price))
  emitCombatSound('vending-coin', VENDING_SOUND_AT)
  return null
}

/** Every row back to its per-day stock (dawn, and the Dev_Panel). */
export function resetVendingStock(): void {
  useVendingStore.getState().setStock(resetAtDawn(useVendingStore.getState().stock))
}

export const openVending = (): void => useOverlayStore.getState().setVendingOpen(true)
export const closeVending = (): void => useOverlayStore.getState().setVendingOpen(false)

/** Within 2.5 m of the machine. */
export function nearVending(): boolean {
  const [x, , z] = usePlayerStore.getState().position
  return withinVendingRange({ x, z }, VENDING_MACHINE.position)
}

/** Closes the panel once the keeper walks away. Returns whether it closed. */
export function closeVendingIfOut(): boolean {
  if (!useOverlayStore.getState().vendingOpen || nearVending()) return false
  closeVending()
  return true
}

/** Dawn restocks the machine (Req 6.11). Returns the unsubscribe function. */
export function installVendingWatchers(): () => void {
  return subscribeToType('dawnStarted', () => resetVendingStock())
}
