// Material stacks currently lying in the world, plus the pickup action.
// Rules live in systems/pickup.ts; this store only applies the result.

import { create } from 'zustand'
import { createRng } from '../rng'
import { pickupMaterial } from '../systems/pickup'
import { dropStack, pickupDrop, type Vec3, type WorldDrop } from '../systems/satchel'
import { ITEM_MAP } from '../../data/items'
import type { ItemId } from '../types'
import { createSpawnWorld, respawnForDay, type SpawnWorld } from '../systems/spawns'
import { useInventoryStore } from './inventoryStore'
import { useToastStore } from './toastStore'

interface SpawnStoreState {
  world: SpawnWorld
  setWorld: (w: SpawnWorld) => void
  /** Stacks the player dropped from the satchel. */
  drops: WorldDrop[]
  /** Move a whole satchel stack to the ground at t. */
  dropFromSatchel: (item: ItemId, at: Vec3) => void
  collectDrop: (dropId: string) => void
  /** Try to pick up a stack; shows the toast and only mutates state on success. */
  collectMaterial: (spawnId: string, index: number) => void
}

let dropCounter = 0

export const useSpawnStore = create<SpawnStoreState>((set, get) => ({
  world: respawnForDay(createSpawnWorld(), createRng(1891)),
  setWorld: (world) => set({ world }),
  drops: [],
  dropFromSatchel: (item, at) => {
    const res = dropStack(useInventoryStore.getState().inventory, item, at, `drop-${++dropCounter}`)
    if (!res.drop) return
    useInventoryStore.getState().setInventory(res.inv)
    set((s) => ({ drops: [...s.drops, res.drop as WorldDrop] }))
    useToastStore.getState().push(`Dropped ${ITEM_MAP[item].name}`)
  },
  collectDrop: (dropId) => {
    const drop = get().drops.find((d) => d.id === dropId)
    if (!drop) return
    const res = pickupDrop(useInventoryStore.getState().inventory, drop)
    if (res.added === 0) {
      useToastStore.getState().push('Satchel full')
      return
    }
    useInventoryStore.getState().setInventory(res.inv)
    set((s) => ({
      drops: s.drops.flatMap((d) => (d.id !== dropId ? [d] : res.remaining ? [res.remaining] : [])),
    }))
    useToastStore.getState().push(`+${res.added} ${ITEM_MAP[drop.item].name}`)
  },
  collectMaterial: (spawnId, index) => {
    const inv = useInventoryStore.getState().inventory
    const res = pickupMaterial(inv, get().world, spawnId, index)
    if (!res) return
    if (res.added > 0) {
      useInventoryStore.getState().setInventory(res.inv)
      set({ world: res.world })
    }
    useToastStore.getState().push(res.toast)
  },
}))

