// Weapon wear rules — pure TypeScript, no React / three.js / Howler.
//
// The cracking warning (once per weapon instance) and which hotbar slot to equip
// after a weapon breaks. MeleeAttack.tsx only applies the results.

/** Hits left at which a weapon starts to crack (docs/game-design.md §4, spec 09 F6). */
export const CRACKING_HITS_LEFT = 5

/** Melee weapons that can be switched to after a break, by item id. */
export const MELEE_WEAPON_IDS: readonly string[] = [
  'rusty-shovel',
  'bone-club',
  'sharpened-shovel',
  'wood-axe',
  'silver-sabre',
]

/**
 * True only on the hit that takes durability from one above the threshold to the threshold.
 * Crossing happens once per weapon instance, so no extra flag is needed, and a weapon
 * loaded from a save at 5 or fewer does not warn again.
 */
export function crossedCracking(before: number | undefined, after: number | undefined): boolean {
  return before === CRACKING_HITS_LEFT + 1 && after === CRACKING_HITS_LEFT
}

/**
 * The hotbar slot to equip once the weapon in `brokenSlot` is gone. `slots` is the hotbar item
 * per slot after the removal. The next melee weapon (searching on from the broken slot, wrapping)
 * wins; with no melee weapon left, the next filled slot; otherwise null.
 */
export function nextSlotAfterBreak(
  slots: readonly (string | null)[],
  brokenSlot: number,
): number | null {
  const n = slots.length
  if (n === 0) return null
  const order = Array.from({ length: n }, (_, i) => (brokenSlot + 1 + i) % n)
  const melee = order.find((s) => {
    const item = slots[s]
    return item !== null && MELEE_WEAPON_IDS.includes(item)
  })
  if (melee !== undefined) return melee
  return order.find((s) => slots[s] !== null) ?? null
}
