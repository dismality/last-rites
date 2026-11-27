import { describe, expect, it } from 'vitest'
import { GATE_DEFS } from '../../data/gateHints'
import { OBJECTIVE_RULES } from '../../data/objectiveRules'
import { TUTORIAL_STEPS } from '../../data/tutorialSteps'
import { FIXED_SPAWNS, SPAWN_POINTS } from '../../data/zones'
import type { Inventory } from '../types'
import {
  digNeed,
  impliesDigFindsCryptKey,
  MOUND_DAY_RUNE_RANGE_M,
} from './digGuidance'
import { createInventory } from './inventory'
import { isRuneVisible } from './interaction'
import type { Vec3 } from './objective'

const MOUNDS: Vec3[] = SPAWN_POINTS.filter((p) => p.lootTable === 'grave-dig').map((p) => p.position)
const bindings = { Hotbar1: 'Digit1', Hotbar2: 'Digit2' }

const withShovel = (hotbar: Inventory['hotbar']): Inventory => ({
  ...createInventory(),
  slots: [{ item: 'rusty-shovel', qty: 1 }],
  hotbar,
})

describe('mound rune by day', () => {
  const base = { distance: 10, fuel: 80, lanternOn: false, day: true }
  it('shows with the lantern off when the mound opts in', () => {
    expect(isRuneVisible({ ...base, dayRuneRangeM: MOUND_DAY_RUNE_RANGE_M })).toBe(true)
  })
  it('stays hidden for other interactables and beyond the range or at night', () => {
    expect(isRuneVisible(base)).toBe(false)
    expect(isRuneVisible({ ...base, distance: 40, dayRuneRangeM: MOUND_DAY_RUNE_RANGE_M })).toBe(false)
    expect(isRuneVisible({ ...base, day: false, dayRuneRangeM: MOUND_DAY_RUNE_RANGE_M })).toBe(false)
  })
})

describe('digNeed', () => {
  it('is null with a shovel in hand', () => {
    const inventory = withShovel(['rusty-shovel', null, null, null])
    expect(digNeed({ inventory, equippedSlot: 0, bindings })).toBeNull()
  })
  it('asks for a shovel and names the hotbar key when it is bound elsewhere', () => {
    const inventory = withShovel([null, 'rusty-shovel', null, null])
    expect(digNeed({ inventory, equippedSlot: null, bindings })).toBe('a shovel in hand: press 2')
  })
  it('asks for a shovel with none carried', () => {
    expect(digNeed({ inventory: createInventory(), equippedSlot: null, bindings })).toBe('a shovel')
  })
})

describe('crypt key copy', () => {
  it('keeps the key on the ground, not in a mound', () => {
    const key = FIXED_SPAWNS.find((f) => f.id === 'fx-crypt-key')
    expect(key?.position).toEqual([-8.4, 0, -21.6])
    expect(MOUNDS.some((m) => m[0] === -8.4 && m[2] === -21.6)).toBe(false)
  })
  it('no hint, objective or tutorial text implies a dig finds the key', () => {
    const copy = [
      ...Object.values(GATE_DEFS).flatMap((g) => [g.hintMissingKey, g.hintWrongSite ?? '']),
      ...OBJECTIVE_RULES.map((r) => `${r.main} ${r.second ?? ''} ${r.marker ?? ''}`),
      ...TUTORIAL_STEPS.map((s) => s.template),
    ]
    for (const text of copy) expect(impliesDigFindsCryptKey(text), text).toBe(false)
  })
  it('the detector does flag a misleading hint', () => {
    expect(impliesDigFindsCryptKey('Dig the Marsh grave for the crypt key')).toBe(true)
  })
})

describe('grave mounds', () => {
  it('has three mounds', () => {
    expect(MOUNDS).toHaveLength(3)
  })
})
