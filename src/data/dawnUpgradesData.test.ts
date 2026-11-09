import { describe, expect, it } from 'vitest'
import { DAWN_UPGRADES, OFFER_SIZE, UPGRADE_PER_RANK } from './dawnUpgrades'

// Expected rows copied from docs/game-design.md §12.
const EXPECTED = [
  ['iron-constitution', 'Iron Constitution', 2],
  ['steady-hands', 'Steady Hands', 2],
  ['long-wick', 'Long Wick', 2],
  ['deep-pockets', 'Deep Pockets', 1],
  ['second-wind', 'Second Wind', 2],
  ['gravedigger', 'Gravedigger', 1],
  ['hardened-boards', 'Hardened Boards', 1],
  ['grim-harvest', 'Grim Harvest', 2],
  ['marksman', 'Marksman', 1],
  ['blessed-reach', 'Blessed Reach', 1],
] as const

describe('dawn upgrade data matches §12', () => {
  it('has the ten upgrades in table order', () => {
    expect(DAWN_UPGRADES.map((u) => u.id)).toEqual(EXPECTED.map((e) => e[0]))
  })

  it.each(EXPECTED)('%s: name and max rank', (id, name, maxRank) => {
    const def = DAWN_UPGRADES.find((u) => u.id === id)
    expect(def?.name, `${id}.name`).toBe(name)
    expect(def?.maxRank, `${id}.maxRank`).toBe(maxRank)
  })

  it('gives every upgrade a distinct non-empty rune', () => {
    for (const u of DAWN_UPGRADES) expect(u.rune.length, `${u.id}.rune`).toBeGreaterThan(0)
    expect(new Set(DAWN_UPGRADES.map((u) => u.rune)).size).toBe(DAWN_UPGRADES.length)
  })

  it('per-rank effects and offer size', () => {
    const want = {
      maxHealth: 15, reload: 0.15, lanternDrain: 0.2, satchelSlots: 2, staminaRegen: 0.25,
      digTime: 0.3, boardHp: 0.25, coinDrop: 0.25, headshot: 0.25, flaskRadiusM: 1,
    }
    for (const [k, v] of Object.entries(want)) {
      expect(UPGRADE_PER_RANK[k as keyof typeof UPGRADE_PER_RANK], `UPGRADE_PER_RANK.${k}`).toBe(v)
    }
    expect(Object.keys(UPGRADE_PER_RANK)).toHaveLength(Object.keys(want).length)
    expect(OFFER_SIZE).toBe(3)
  })
})
