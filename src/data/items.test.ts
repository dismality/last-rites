import { describe, it, expect } from 'vitest'
import { ITEMS, ITEM_MAP, usesSatchelSlot, MATERIAL_STACK_LIMIT } from './items'
import { LOOT_TABLES, LOOT_TABLE_MAP } from './lootTables'
import { SPAWN_POINTS, FIXED_SPAWNS } from './zones'

describe('content data integrity', () => {
  it('has unique item ids', () => {
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length)
  })

  it('stacks materials to the limit and everything else singly', () => {
    for (const item of ITEMS) {
      expect(item.stackLimit).toBe(item.kind === 'material' ? MATERIAL_STACK_LIMIT : 1)
    }
  })

  it('keeps key items, relics and lore out of satchel slots', () => {
    expect(usesSatchelSlot(ITEM_MAP['rusted-crypt-key'].kind)).toBe(false)
    expect(usesSatchelSlot(ITEM_MAP['bone'].kind)).toBe(true)
  })

  it('has valid loot entries', () => {
    for (const t of LOOT_TABLES) {
      expect(t.rolls).toBeGreaterThan(0)
      for (const e of t.entries) {
        expect(e.weight).toBeGreaterThan(0)
        expect(e.min).toBeGreaterThanOrEqual(1)
        expect(e.max).toBeGreaterThanOrEqual(e.min)
      }
    }
  })

  it('points every spawn at a real table and item', () => {
    for (const s of SPAWN_POINTS) expect(LOOT_TABLE_MAP[s.lootTable]).toBeDefined()
    for (const f of FIXED_SPAWNS) expect(ITEM_MAP[f.item]).toBeDefined()
  })

  it('spawns each fixed item once and only the locket at night', () => {
    expect(new Set(FIXED_SPAWNS.map((f) => f.item)).size).toBe(FIXED_SPAWNS.length)
    expect(FIXED_SPAWNS.filter((f) => f.nightOnly).map((f) => f.item)).toEqual(['childs-locket'])
  })
})
