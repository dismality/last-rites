import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { DOORS } from './barricades'
import { ELITE_DROPS } from './elites'
import { ITEM_MAP } from './items'
import { LOOT_TABLES } from './lootTables'
import { RECIPES } from './recipes'
import { WEAPON_UPGRADES } from './upgrades'
import { WEAPON_PICKUPS } from './weaponPickups'

/** One data entry and every item id it names. */
interface RefEntry {
  entry: string
  refs: readonly string[]
}

const REAL_ENTRIES: readonly RefEntry[] = [
  ...RECIPES.map((r) => ({
    entry: `recipe ${r.id}`,
    refs: [...r.inputs.map((i) => i.item), r.output.item, ...(r.consumesTool ? [r.consumesTool] : [])],
  })),
  ...WEAPON_UPGRADES.map((u) => ({ entry: `upgrade ${u.id}`, refs: u.cost.map((c) => c.item) })),
  ...ELITE_DROPS.map((d) => ({ entry: `elite drop ${d.item}`, refs: [d.item] })),
  ...LOOT_TABLES.map((t) => ({ entry: `loot table ${t.id}`, refs: t.entries.map((e) => e.item) })),
  ...WEAPON_PICKUPS.map((p) => ({
    entry: `weapon pickup ${p.id}`,
    refs: [p.id, ...(p.ammo ? [p.ammo.id] : [])],
  })),
  { entry: 'barricade nail cost', refs: DOORS.nailCost.map((c) => c.item) },
]

/** Returns one message per missing id, naming the entry and the id. */
function findMissingRefs(entries: readonly RefEntry[], known: ReadonlySet<string>): string[] {
  return entries.flatMap((e) =>
    e.refs.filter((id) => !known.has(id)).map((id) => `${e.entry} names missing item "${id}"`),
  )
}

const KNOWN = new Set(Object.keys(ITEM_MAP))

describe('combat data referential integrity', () => {
  /** Feature: 07-combat-and-enemies, Property 1 */
  it('Feature: 07-combat-and-enemies, Property 1: every named item id exists', () => {
    // **Validates: Requirements 1.10, 1.11**
    fc.assert(
      fc.property(fc.subarray([...REAL_ENTRIES], { minLength: 1 }), (entries) => {
        expect(findMissingRefs(entries, KNOWN)).toEqual([])
      }),
    )
    expect(findMissingRefs(REAL_ENTRIES, KNOWN)).toEqual([])
  })

  /** Feature: 07-combat-and-enemies, Property 1 (the check itself can fail) */
  it('Feature: 07-combat-and-enemies, Property 1: a broken entry is named with its missing id', () => {
    // **Validates: Requirements 1.10, 1.11**
    const bogusId = fc.stringMatching(/^[a-z]{3,12}-ghost$/)
    fc.assert(
      fc.property(fc.constantFrom(...REAL_ENTRIES), bogusId, fc.nat(), (real, bogus, at) => {
        const refs = [...real.refs]
        refs.splice(at % (refs.length + 1), 0, bogus)
        const failures = findMissingRefs([{ entry: real.entry, refs }], KNOWN)
        expect(failures).toEqual([`${real.entry} names missing item "${bogus}"`])
      }),
    )
  })

  it('a deliberately broken recipe fails naming the recipe and the missing id', () => {
    const broken: RefEntry = { entry: 'recipe r-broken', refs: ['bone', 'unobtainium'] }
    expect(findMissingRefs([broken], KNOWN)).toEqual(['recipe r-broken names missing item "unobtainium"'])
  })
})
