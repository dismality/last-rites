// Loot rolling: weighted draws from a table, quantities within each entry's min/max.
// Pure TypeScript so it can be tested in Node with a seeded RNG.

import type { LootTable } from '../../data/lootTables'
import type { ItemStack } from '../types'
import { randInt, type Rng } from '../rng'

export function rollLoot(table: LootTable, rng: Rng): ItemStack[] {
  const entries = table.entries.filter((e) => e.weight > 0)
  const total = entries.reduce((sum, e) => sum + e.weight, 0)
  if (total <= 0) return []

  // One stack per draw (not merged) so each stack stays within its entry's min/max.
  const result: ItemStack[] = []
  for (let i = 0; i < table.rolls; i++) {
    let pick = rng() * total
    let chosen = entries[entries.length - 1]
    for (const e of entries) {
      pick -= e.weight
      if (pick < 0) {
        chosen = e
        break
      }
    }
    result.push({ item: chosen.item, qty: randInt(rng, chosen.min, chosen.max) })
  }
  return result
}
