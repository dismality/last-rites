// Grave digging glue: reads hover, equipped item and player state, steps the pure
// tickDig rule at the fixed timestep, and reveals loot on the grave only once the dig
// finishes. No React / three.js imports.

import { create } from 'zustand'
import { SPAWN_POINTS } from '../../data/zones'
import { ITEM_MAP } from '../../data/items'
import { emit, subscribeToType } from '../events'
import { createRng, type Rng } from '../rng'
import {
  canDig,
  createDigState,
  digProgress,
  hasShovel,
  tickDig,
  type DigState,
} from '../systems/dig'
import { hotbarItem } from '../systems/satchel'
import { liveDigDuration } from '../systems/digDuration'
import { currentModifiers } from './derivedStats'
import { useInteractionStore } from './interactionStore'
import { useInventoryStore } from './inventoryStore'
import { isMenuOpen } from './menuState'
import { usePlayerStore } from './playerStore'
import { useSpawnStore } from './spawnStore'
import { useToastStore } from './toastStore'
import { useWorldStore } from './worldStore'

/** Interactable ids of diggable graves are `dig:<spawn point id>`. */
export const DIG_ID_PREFIX = 'dig:'

export function diggableGraves() {
  return SPAWN_POINTS.filter((p) => p.lootTable === 'grave-dig')
}

interface DigStoreState {
  dig: DigState
  /** 0-1 progress of the dig in progress, for the HUD bar. */
  progress: number
  active: boolean
  step: (dt: number, interactHeld: boolean) => void
  /** Why a press on a grave does nothing right now, or null when digging can start. */
  blockedReason: (graveId: string) => string | null
  reset: () => void
}

let rng: Rng = createRng((Math.random() * 0xffffffff) >>> 0)
let hitPending = false
subscribeToType('playerDamaged', () => {
  hitPending = true
})

const CANCEL_TEXT = {
  moved: 'You stepped away. The dig is abandoned.',
  hit: 'Struck while digging.',
  released: 'You stopped digging.',
  interrupted: 'You lost the grave. Dig again.',
} as const

export const useDigStore = create<DigStoreState>((set, get) => ({
  dig: createDigState(),
  progress: 0,
  active: false,
  blockedReason: (graveId) => {
    const inv = useInventoryStore.getState()
    const equipped = inv.equippedSlot === null ? null : hotbarItem(inv.inventory, inv.equippedSlot)
    if (!hasShovel(equipped)) return 'You need a shovel in hand to dig.'
    if (!canDig(get().dig, graveId, useWorldStore.getState().nightNumber))
      return 'This grave is already dug today.'
    return null
  },
  step: (dt, interactHeld) => {
    const { dig } = get()
    const hoverId = useInteractionStore.getState().hover?.id ?? null
    const graveId = hoverId?.startsWith(DIG_ID_PREFIX) ? hoverId.slice(DIG_ID_PREFIX.length) : null
    const point = graveId ? diggableGraves().find((p) => p.id === graveId) : undefined
    const inv = useInventoryStore.getState()
    const world = useWorldStore.getState()
    const hit = hitPending
    hitPending = false

    const durationS = liveDigDuration(currentModifiers().digTimeMult)
    const r = tickDig(dig, dt, {
      durationS,
      // A satchel or journal opened mid-dig counts as letting go.
      interactHeld: interactHeld && !isMenuOpen(),
      target: point ? { id: point.id, lootTable: point.lootTable } : null,
      equipped: inv.equippedSlot === null ? null : hotbarItem(inv.inventory, inv.equippedSlot),
      position: usePlayerStore.getState().position,
      hit,
      day: world.nightNumber,
      phase: world.phase,
      rng,
    })
    set({ dig: r.state, progress: digProgress(r.state, durationS), active: r.state.graveId !== null })

    for (const e of r.events) {
      if (e.type === 'digCompleted') {
        // Loot appears on the grave only now; before this the mound shows nothing.
        const spawn = useSpawnStore.getState()
        const prev = spawn.world.materials[e.graveId] ?? []
        spawn.setWorld({
          ...spawn.world,
          materials: { ...spawn.world.materials, [e.graveId]: [...prev, ...e.loot] },
        })
        const names = e.loot.map((s) => `${s.qty} ${ITEM_MAP[s.item].name}`).join(', ')
        useToastStore.getState().push(names ? `The grave yields: ${names}` : 'The grave is empty.')
      } else {
        useToastStore.getState().push(CANCEL_TEXT[e.reason])
      }
      emit(e)
    }
  },
  reset: () => {
    hitPending = false
    rng = createRng((Math.random() * 0xffffffff) >>> 0)
    set({ dig: createDigState(), progress: 0, active: false })
  },
}))
