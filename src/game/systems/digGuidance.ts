// Pure helpers that make digging findable: the prompt note that explains a missing shovel, and
// the copy rule that no hint may promise the Rusted Crypt Key from a dig (the key lies on the
// ground, see zones.ts). Grave mounds are never the objective marker.

import type { Inventory, ItemId } from '../types'
import { hasShovel } from './dig'
import { keyLabel } from './interaction'
import { hotbarItem } from './satchel'

/** Daylight range (m) inside which a mound's rune shows whether or not the lantern is lit. */
export const MOUND_DAY_RUNE_RANGE_M = 16

const SHOVELS: readonly ItemId[] = ['sharpened-shovel', 'rusty-shovel']

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
}

/**
 * What a mound is missing, worded to follow "Needs " ("Needs a shovel in hand: press 2"), or null
 * when digging can start right now. A dug grave never gets here: it is used up and has no prompt.
 */
export function digNeed(i: DigNoteInput): string | null {
  const inHand = i.equippedSlot === null ? null : hotbarItem(i.inventory, i.equippedSlot)
  if (hasShovel(inHand)) return null
  const slot = shovelHotbarSlot(i.inventory)
  if (slot !== null) {
    const code = i.bindings[`Hotbar${slot + 1}`] ?? `Digit${slot + 1}`
    return `a shovel in hand: press ${keyLabel(code)}`
  }
  const carried = i.inventory.slots.some((s) => SHOVELS.includes(s.item))
  return carried ? 'a shovel in hand: bind it to a hotbar slot in the satchel' : 'a shovel'
}

/** True when copy tells the player a dig turns up the crypt key. Used by the copy test. */
export function impliesDigFindsCryptKey(text: string): boolean {
  const t = text.toLowerCase()
  const key = /crypt key|rusted key/.test(t)
  const dig = /\bdig\b|\bdug\b|\bdigging\b|grave|buried|beneath|under the/.test(t)
  return key && dig
}
