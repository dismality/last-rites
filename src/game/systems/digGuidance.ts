// Pure helpers that make digging findable: the prompt note that explains a missing shovel,
// the tutorial marker that points at the nearest mound, and the copy rule that no hint may
// promise the Rusted Crypt Key from a dig (the key lies on the ground, see zones.ts).

import type { Inventory, ItemId } from '../types'
import { hasShovel } from './dig'
import { keyLabel } from './interaction'
import { hotbarItem } from './satchel'
import type { Objective, Vec3 } from './objective'

/** Daylight range (m) inside which a mound's rune shows whether or not the lantern is lit. */
export const MOUND_DAY_RUNE_RANGE_M = 16

const SHOVELS: readonly ItemId[] = ['sharpened-shovel', 'rusty-shovel']
export const DIG_TUTORIAL_MARKER = 'Grave mound'

/** Hotbar slot (0-3) holding a usable shovel, or null. */
export function shovelHotbarSlot(inv: Inventory): number | null {
  for (let slot = 0; slot < 4; slot++) {
    if (hasShovel(hotbarItem(inv, slot))) return slot
  }
  return null
}

export interface DigNoteInput {
  inventory: Inventory
  equippedSlot: number | null
  bindings: Readonly<Record<string, string>>
  dugToday: boolean
}

/** Short note shown beside "Hold E: Dig", or null when digging can start right now. */
export function digPromptNote(i: DigNoteInput): string | null {
  if (i.dugToday) return 'Already dug today'
  const inHand = i.equippedSlot === null ? null : hotbarItem(i.inventory, i.equippedSlot)
  if (hasShovel(inHand)) return null
  const slot = shovelHotbarSlot(i.inventory)
  if (slot !== null) {
    const code = i.bindings[`Hotbar${slot + 1}`] ?? `Digit${slot + 1}`
    return `Need a shovel in hand to dig: press ${keyLabel(code)}`
  }
  const carried = i.inventory.slots.some((s) => SHOVELS.includes(s.item))
  return carried
    ? 'Need a shovel in hand to dig: bind it to a hotbar slot in the satchel'
    : 'Need a shovel in hand to dig'
}

const dist2 = (a: Vec3, b: Vec3): number => (a[0] - b[0]) ** 2 + (a[2] - b[2]) ** 2

/** Nearest mound to `from`, or undefined with no mounds. */
export function nearestMound(from: Vec3, mounds: readonly Vec3[]): Vec3 | undefined {
  let best: Vec3 | undefined
  let bestD = Infinity
  for (const m of mounds) {
    const d = dist2(m, from)
    if (d < bestD) {
      bestD = d
      best = m
    }
  }
  return best
}

/**
 * While the dig tutorial step is the current one, the objective marker (and so the compass
 * diamond) points at the nearest mound instead of the objective's own place.
 */
export function withDigTutorialMarker(
  objective: Objective,
  digStepActive: boolean,
  playerPos: Vec3,
  mounds: readonly Vec3[],
): Objective {
  if (!digStepActive) return objective
  const target = nearestMound(playerPos, mounds)
  if (!target) return objective
  return { ...objective, position: target, marker: DIG_TUTORIAL_MARKER }
}

/** True when copy tells the player a dig turns up the crypt key. Used by the copy test. */
export function impliesDigFindsCryptKey(text: string): boolean {
  const t = text.toLowerCase()
  const key = /crypt key|rusted key/.test(t)
  const dig = /\bdig\b|\bdug\b|\bdigging\b|grave|buried|beneath|under the/.test(t)
  return key && dig
}
