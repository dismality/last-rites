// Combat state store — persisted weapon state (magazines, durability, upgrades, taken
// pickups) plus the live timers that Night_State clears. No React / three.js imports.

import { create } from 'zustand'
import { WEAPON_PICKUPS } from '../../data/weaponPickups'
import type { WeaponPickupId } from '../../data/weaponPickups'
import type { ConsumableUseState } from '../systems/consumables'
import type { DodgeState } from '../systems/dodge'
import type { ChargeState } from '../systems/heavyAttack'
import { DURABLE_IDS } from '../systems/combatSave'
import type { DurableId } from '../systems/combatSave'
import { maxDurability } from '../systems/durability'
import { countItem } from '../systems/inventory'
import { hotbarItem } from '../systems/satchel'
import { buyUpgrade as buyUpgradeRule, firearmStats } from '../systems/upgrades'
import type { BuyResult } from '../systems/upgrades'
import { takePickup as takePickupRule } from '../systems/weaponPickups'
import type { TakeResult } from '../systems/weaponPickups'
import type { FirearmId, Inventory, ItemId, UpgradeId } from '../types'
import { useCraftingStore } from './craftingStore'
import { useInventoryStore } from './inventoryStore'

const FIREARM_IDS: readonly FirearmId[] = ['revolver', 'shotgun']

export interface CombatLive {
  heldId: ItemId | null
  sinceShotS: number
  reload: { weapon: FirearmId; leftS: number; totalS: number } | null
  charge: ChargeState | null
  releaseRequest: 'heavy' | 'normal' | 'tooTired' | null
  tooTiredS: number
  kickLeftS: number
  dodge: DodgeState | null
  dodgeCooldownS: number
  use: ConsumableUseState | null
  /** Aim held with a melee weapon: incoming blows are reduced and walking slows (Req 5.3). */
  blocking: boolean
}

export const initialLive = (): CombatLive => ({
  heldId: null,
  sinceShotS: 0,
  reload: null,
  charge: null,
  releaseRequest: null,
  tooTiredS: 0,
  kickLeftS: 0,
  dodge: null,
  dodgeCooldownS: 0,
  use: null,
  blocking: false,
})

export interface CombatState {
  // Persisted: see combatPersistence.ts.
  firearms: Partial<Record<FirearmId, { magazine: number }>>
  durability: Partial<Record<DurableId, number>>
  upgrades: UpgradeId[]
  takenPickups: WeaponPickupId[]
  // Live: never saved or snapshotted.
  live: CombatLive

  /**
   * Creates the state a weapon needs the first time it is in the satchel. An entry for an
   * item that is no longer in the satchel is kept (it may be on the ground). When the held
   * item changed, reload, charge and consumable use are cancelled.
   */
  reconcile: (inventory: Inventory, heldId?: ItemId | null) => void
  setMagazine: (weapon: FirearmId, magazine: number) => void
  /** Spends 1 durability. At 0 the entry is deleted and `true` is returned: the caller removes the item. */
  spendDurability: (weapon: DurableId) => boolean
  takePickup: (id: WeaponPickupId) => TakeResult
  buyUpgrade: (id: UpgradeId) => BuyResult
  patchLive: (patch: Partial<CombatLive>) => void
  resetLive: () => void
}

const isDurable = (id: ItemId): id is DurableId => (DURABLE_IDS as readonly string[]).includes(id)

function heldFromInventory(): ItemId | null {
  const { inventory, equippedSlot } = useInventoryStore.getState()
  return equippedSlot === null ? null : hotbarItem(inventory, equippedSlot)
}

export const useCombatStore = create<CombatState>((set, get) => ({
  firearms: {},
  durability: {},
  upgrades: [],
  takenPickups: [],
  live: initialLive(),

  reconcile: (inventory, heldId) => {
    const s = get()
    const held = heldId === undefined ? heldFromInventory() : heldId
    let firearms = s.firearms
    let durability = s.durability
    for (const id of FIREARM_IDS) {
      if (firearms[id] || countItem(inventory, id) <= 0) continue
      const capacity = firearmStats(id, s.upgrades).capacity
      const start = WEAPON_PICKUPS.find((p) => p.id === id)?.magazine ?? capacity
      firearms = { ...firearms, [id]: { magazine: Math.min(start, capacity) } }
    }
    for (const id of DURABLE_IDS) {
      if (durability[id] !== undefined || countItem(inventory, id) <= 0) continue
      const max = maxDurability(id, s.upgrades)
      if (max !== null) durability = { ...durability, [id]: max }
    }
    const changed = held !== s.live.heldId
    // Idle steps must not write, so subscribers are not woken sixty times a second.
    if (firearms === s.firearms && durability === s.durability && !changed) return
    set({
      firearms,
      durability,
      live: changed
        ? { ...s.live, heldId: held, reload: null, charge: null, releaseRequest: null, use: null }
        : s.live,
    })
  },

  setMagazine: (weapon, magazine) =>
    set((s) => {
      const capacity = firearmStats(weapon, s.upgrades).capacity
      const value = Math.max(
        0,
        Math.min(capacity, Math.floor(Number.isFinite(magazine) ? magazine : 0)),
      )
      return { firearms: { ...s.firearms, [weapon]: { magazine: value } } }
    }),

  spendDurability: (weapon) => {
    const left = get().durability[weapon]
    if (left === undefined) return false
    if (left <= 1) {
      const rest = { ...get().durability }
      delete rest[weapon]
      set({ durability: rest })
      return true
    }
    set((s) => ({ durability: { ...s.durability, [weapon]: left - 1 } }))
    return false
  },

  takePickup: (id) => {
    const inv = useInventoryStore.getState()
    const crafting = useCraftingStore.getState()
    const s = get()
    const res = takePickupRule(inv.inventory, s.takenPickups, crafting.unlockedRecipes, id)
    if (!res.ok) return res
    inv.setInventory(res.inv)
    useCraftingStore.setState({ unlockedRecipes: res.recipes })
    const def = WEAPON_PICKUPS.find((p) => p.id === id)!
    set({
      takenPickups: res.taken,
      firearms:
        res.magazine !== null && (id === 'revolver' || id === 'shotgun')
          ? { ...s.firearms, [id]: { magazine: res.magazine } }
          : s.firearms,
      durability:
        isDurable(def.id as ItemId) && s.durability[def.id as DurableId] === undefined
          ? { ...s.durability, [def.id]: maxDurability(def.id as DurableId, s.upgrades) ?? 0 }
          : s.durability,
    })
    return res
  },

  buyUpgrade: (id) => {
    const inv = useInventoryStore.getState()
    const res = buyUpgradeRule(inv.inventory, get().upgrades, id)
    if (!res.ok) return res
    inv.setInventory(res.inv)
    set({ upgrades: res.bought })
    return res
  },

  patchLive: (patch) => set((s) => ({ live: { ...s.live, ...patch } })),

  resetLive: () => set({ live: initialLive() }),
}))
