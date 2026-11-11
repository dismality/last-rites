// Which items the player has ever held (pure). A recipe reveals its name once one of each
// ingredient has been held (spec 09, B9). No React / three.js.
import type { Inventory, ItemId } from '../types'

/** Items held right now, added to the ever-collected list (order kept, no repeats). */
export function mergeCollected(prev: readonly ItemId[], inv: Inventory): ItemId[] {
  const seen = new Set(prev)
  const next = [...prev]
  for (const s of inv.slots) {
    if (s.qty > 0 && !seen.has(s.item)) {
      seen.add(s.item)
      next.push(s.item)
    }
  }
  return next
}