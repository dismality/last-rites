// Reads the stores and says, for one interactable, whether it is used up, blocked by something
// the player can fix, or idle. The wording and the category live in data/interactables.ts and the
// cue rule in systems/interactionCue.ts; this file only gathers facts. Pure zustand, no React.
//
// `subject` identifies the instance: grave id, tombstone id, clue id, `spawnId:index`, drop id,
// weapon pickup id, gate id, door id. Kinds with a single instance ignore it.
//
// Nothing here is stored: everything is derived from the live stores, so a new day, Retry Night,
// Continue and New Game need no cue reset of their own.

import { DOORS } from '../../data/barricades'
import { GATE_DEFS } from '../../data/gateHints'
import type { InteractableKind } from '../../data/interactables'
import { ITEM_MAP } from '../../data/items'
import { TOMBSTONE_MAP, type TombstoneId } from '../../data/tombstones'
import type { WeaponPickupId } from '../../data/weaponPickups'
import { digNeed } from '../systems/digGuidance'
import { nailPrompt } from '../systems/barricade'
import type { CueFacts } from '../systems/interactionCue'
import { MYSTERY_GATE_KEYS, type MysteryGateId } from '../systems/mystery'
import { pickupMaterial } from '../systems/pickup'
import { pickupDrop } from '../systems/satchel'
import { canTakePickup } from '../systems/weaponPickups'
import { canDiscoverClue, readTombstone } from '../systems/tombstones'
import type { DoorId } from '../types'
import { useCombatStore } from './combatStore'
import { useDigStore } from './digStore'
import { useDoorStore } from './doorStore'
import { useInventoryStore } from './inventoryStore'
import { useMysteryStore } from './mysteryStore'
import { useProgressionStore } from './progressionStore'
import { useSettingsStore } from './settingsStore'
import { useSpawnStore } from './spawnStore'
import { useTombstoneStore } from './tombstoneStore'
import { useWorldStore } from './worldStore'

const SATCHEL_FULL = 'satchel space'
const OPEN: CueFacts = { usedUp: false }

/** Gate need: the key's name, or what to do with it when the key is held but this is the wrong place. */
function gateNeed(gate: MysteryGateId, held: readonly string[], site: 'gate' | 'altar'): string | null {
  const def = GATE_DEFS[gate]
  const key = MYSTERY_GATE_KEYS[gate]
  if (!held.includes(key)) return `the ${ITEM_MAP[key].name}`
  if (def.site !== site) return `the ${ITEM_MAP[key].name} used at the chapel altar`
  return null
}

export function readCueFacts(kind: InteractableKind, subject = ''): CueFacts {
  switch (kind) {
    case 'grave-mound': {
      const day = useWorldStore.getState().nightNumber
      if (useDigStore.getState().dig.dugOnDay[subject] === day) return { usedUp: true }
      const inv = useInventoryStore.getState()
      return {
        usedUp: false,
        need: digNeed({
          inventory: inv.inventory,
          equippedSlot: inv.equippedSlot,
          bindings: useSettingsStore.getState().bindings,
        }),
      }
    }
    case 'material-pickup': {
      const cut = subject.lastIndexOf(':')
      const spawnId = subject.slice(0, cut)
      const index = Number(subject.slice(cut + 1))
      const world = useSpawnStore.getState().world
      if (!world.materials[spawnId]?.[index]) return { usedUp: true }
      const res = pickupMaterial(useInventoryStore.getState().inventory, world, spawnId, index)
      return res && res.added === 0 ? { usedUp: false, need: SATCHEL_FULL } : OPEN
    }
    case 'dropped-stack': {
      const drop = useSpawnStore.getState().drops.find((d) => d.id === subject)
      if (!drop) return { usedUp: true }
      return pickupDrop(useInventoryStore.getState().inventory, drop).added === 0
        ? { usedUp: false, need: SATCHEL_FULL }
        : OPEN
    }
    case 'fixed-spawn':
      // A fixed spawn is only mounted while it is available; the scene marks a taken one used up.
      return OPEN
    case 'clue-spot': {
      if (useMysteryStore.getState().mystery.clues.has(subject)) return { usedUp: true }
      const held = useInventoryStore.getState().inventory
      return canDiscoverClue(subject, held) ? OPEN : { usedUp: false, need: 'the parish ledger' }
    }
    case 'tombstone': {
      const stone = TOMBSTONE_MAP[subject as TombstoneId]
      if (!stone) return OPEN
      const clues = useMysteryStore.getState().mystery.clues
      const reading = readTombstone(stone, useInventoryStore.getState().inventory)
      const read =
        useTombstoneStore.getState().readIds.includes(stone.id) ||
        (stone.clueId !== undefined && clues.has(stone.clueId))
      return { usedUp: false, idle: read && reading.clueIds.every((c) => clues.has(c)) }
    }
    case 'gate': {
      const gate = subject as MysteryGateId
      if (useMysteryStore.getState().mystery.gates[gate]) return { usedUp: true }
      const need = gateNeed(gate, useInventoryStore.getState().inventory.keyItems, 'gate')
      return need ? { usedUp: false, need } : OPEN
    }
    case 'altar-whistle':
      return { usedUp: useMysteryStore.getState().mystery.gates.catacombs }
    case 'weapon-pickup': {
      const id = subject as WeaponPickupId
      if (useCombatStore.getState().takenPickups.includes(id)) return { usedUp: true }
      const check = canTakePickup(
        useInventoryStore.getState().inventory,
        useCombatStore.getState().takenPickups,
        id,
      )
      return !check.ok && check.reason === 'satchel-full' ? { usedUp: false, need: SATCHEL_FULL } : OPEN
    }
    case 'merchant': {
      const stock = useProgressionStore.getState().stock
      return { usedUp: stock !== null && stock.rows.every((r) => r.qty <= 0) }
    }
    case 'barricade-door': {
      const door = subject as DoorId
      const { built, doors } = useDoorStore.getState()
      if (!doors[door]) return OPEN
      if (built && doors[door].length >= DOORS.slots) return { usedUp: false, idle: true }
      const p = nailPrompt({ built, doors }, useInventoryStore.getState().inventory, door)
      return p.canStart ? OPEN : { usedUp: false, need: p.text }
    }
    case 'workbench':
      return OPEN
  }
}
