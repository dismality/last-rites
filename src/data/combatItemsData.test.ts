// Spec 07 task 1.2: items, weapons, recipes and loot equal the design bible rows.
// Each check names the id and field so a mismatch is easy to find.

import { describe, expect, it } from 'vitest'
import type { ItemId, RecipeId } from '../game/types'
import { ITEM_MAP, usesSatchelSlot } from './items'
import { LOOT_TABLE_MAP, type LootTableId } from './lootTables'
import { RECIPE_MAP, type RecipeDef } from './recipes'
import { WEAPON_MAP } from './weapons'

/** Compare one field and fail with `id.field` in the message. */
function check(id: string, field: string, actual: unknown, expected: unknown): void {
  expect(actual, `${id}.${field}`).toEqual(expected)
}

describe('items (bible §3)', () => {
  const materials: [ItemId, number][] = [
    ['wood-plank', 10],
    ['black-powder', 10],
    ['lead-shot', 10],
    ['silver-filings', 10],
  ]
  it.each(materials)('material %s stacks to %i', (id, limit) => {
    check(id, 'kind', ITEM_MAP[id].kind, 'material')
    check(id, 'stackLimit', ITEM_MAP[id].stackLimit, limit)
    check(id, 'usesSlot', usesSatchelSlot(ITEM_MAP[id].kind), true)
  })

  const ammo: [ItemId, number][] = [
    ['revolver-cartridge', 36],
    ['shotgun-shell', 20],
  ]
  it.each(ammo)('ammo %s stacks to %i and uses a slot', (id, limit) => {
    check(id, 'kind', ITEM_MAP[id].kind, 'ammo')
    check(id, 'stackLimit', ITEM_MAP[id].stackLimit, limit)
    check(id, 'usesSlot', usesSatchelSlot(ITEM_MAP[id].kind), true)
  })

  const crafted: [ItemId, string][] = [
    ['revolver', 'weapon'],
    ['shotgun', 'weapon'],
    ['wood-axe', 'weapon'],
    ['silver-sabre', 'weapon'],
    ['blessed-rounds', 'consumable'],
    ['kola-tonic', 'consumable'],
  ]
  it.each(crafted)('crafted %s is a single-slot %s', (id, kind) => {
    check(id, 'kind', ITEM_MAP[id].kind, kind)
    check(id, 'stackLimit', ITEM_MAP[id].stackLimit, 1)
  })
})

describe('weapons (bible §4)', () => {
  const rows = [
    ['revolver', 'firearm', 34, 0.45, null],
    ['shotgun', 'firearm', 9, 0.3, null],
    ['wood-axe', 'heavy', 30, 0.85, 60],
    ['silver-sabre', 'heavy', 28, 0.55, null],
  ] as const
  it.each(rows)('%s is %s: damage %d, speed %d, durability %s', (id, kind, damage, speed, dur) => {
    const w = WEAPON_MAP[id]
    check(id, 'kind', w.kind, kind)
    check(id, 'damage', w.damage, damage)
    check(id, 'cooldown', w.cooldown, speed)
    check(id, 'durability', w.durability, dur)
  })

  it('consumables carry the effect they apply', () => {
    check('blessed-rounds', 'effect', WEAPON_MAP['blessed-rounds'].effect, 'blessed-rounds')
    check('kola-tonic', 'effect', WEAPON_MAP['kola-tonic'].effect, 'adrenaline')
    check('blessed-rounds', 'kind', WEAPON_MAP['blessed-rounds'].kind, 'consumable')
    check('kola-tonic', 'kind', WEAPON_MAP['kola-tonic'].kind, 'consumable')
  })
})

describe('recipes (bible §5)', () => {
  const rows: [RecipeId, RecipeDef['inputs'], RecipeDef['output'], RecipeDef['unlock'], boolean][] = [
    [
      'r-revolver-cartridge',
      [
        { item: 'black-powder', qty: 1 },
        { item: 'lead-shot', qty: 1 },
      ],
      { item: 'revolver-cartridge', qty: 6 },
      { type: 'pickup', weapon: 'revolver' },
      true,
    ],
    [
      'r-shotgun-shell',
      [
        { item: 'black-powder', qty: 1 },
        { item: 'lead-shot', qty: 2 },
        { item: 'cloth', qty: 1 },
      ],
      { item: 'shotgun-shell', qty: 4 },
      { type: 'pickup', weapon: 'shotgun' },
      true,
    ],
    [
      'r-blessed-rounds',
      [
        { item: 'holy-water', qty: 1 },
        { item: 'silver-filings', qty: 1 },
      ],
      { item: 'blessed-rounds', qty: 1 },
      { type: 'night', night: 2 },
      false,
    ],
  ]
  it.each(rows)('%s equals its bible row', (id, inputs, output, unlock, partial) => {
    const r = RECIPE_MAP[id]
    check(id, 'inputs', r.inputs, inputs)
    check(id, 'output', r.output, output)
    check(id, 'unlock', r.unlock, unlock)
    check(id, 'outputCap', r.outputCap, partial ? 'partial' : undefined)
  })
})

describe('loot (bible §3)', () => {
  const has = (table: LootTableId, item: string) =>
    LOOT_TABLE_MAP[table].entries.some((e) => e.item === item)

  it('adds the (07) materials to their sources', () => {
    check('broken-coffin', 'lead-shot', has('broken-coffin', 'lead-shot'), true)
    check('broken-coffin', 'wood-plank', has('broken-coffin', 'wood-plank'), true)
    check('crypt-shelves', 'black-powder', has('crypt-shelves', 'black-powder'), true)
    check('crypt-shelves', 'kola-tonic', has('crypt-shelves', 'kola-tonic'), true)
    check('catacomb-walls', 'silver-filings', has('catacomb-walls', 'silver-filings'), true)
  })

  it('rare entries weigh 1', () => {
    const w = (t: LootTableId, i: string) => LOOT_TABLE_MAP[t].entries.find((e) => e.item === i)?.weight
    check('crypt-shelves', 'black-powder.weight', w('crypt-shelves', 'black-powder'), 1)
    check('crypt-shelves', 'kola-tonic.weight', w('crypt-shelves', 'kola-tonic'), 1)
    check('catacomb-walls', 'silver-filings.weight', w('catacomb-walls', 'silver-filings'), 1)
  })

  it('woodpile gives 2 to 4 planks and the powder tin gives 1 powder', () => {
    check('woodpile', 'entries', LOOT_TABLE_MAP.woodpile.entries, [
      { item: 'wood-plank', weight: 1, min: 2, max: 4 },
    ])
    check('powder-tin', 'entries', LOOT_TABLE_MAP['powder-tin'].entries, [
      { item: 'black-powder', weight: 1, min: 1, max: 1 },
    ])
  })
})
