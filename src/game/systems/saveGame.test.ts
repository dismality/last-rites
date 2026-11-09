import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { createMysteryState } from './mystery'
import { defaultProgressionSave } from './progressionSave'
import {
  SAVE_KEY,
  SAVE_VERSION,
  fromSaveFile,
  hasPassedFirstDay,
  hasValidSave,
  readSave,
  toSaveFile,
  writeSave,
} from './saveGame'
import type { SaveState } from './saveGame'
import type { TutorialStepId } from '../../data/tutorialSteps'
import type { PageNumber, RelicId } from '../types'

function memoryStorage(initial?: string) {
  const data = new Map<string, string>()
  if (initial !== undefined) data.set(SAVE_KEY, initial)
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  }
}

// JSON has no -0, so normalise it; the difference is meaningless for gameplay.
const num = fc
  .double({ min: -1000, max: 1000, noNaN: true, noDefaultInfinity: true })
  .map((n) => (Object.is(n, -0) ? 0 : n))
const relicIds: RelicId[] = [
  'crane-rosary',
  'sextons-bell-clapper',
  'childs-locket',
  'burial-shroud',
  'reliquary-heart',
]

const saveStateArb: fc.Arbitrary<SaveState> = fc.record({
  world: fc.record({
    phase: fc.constantFrom('day', 'dusk', 'night', 'dawn' as const),
    phaseTime: num,
    nightNumber: fc.integer({ min: 1, max: 5 }),
    fogDensity: fc.double({ min: 0, max: 0.1, noNaN: true }),
    wavesCleared: fc.boolean(),
  }),
  player: fc.record({
    position: fc.tuple(num, num, num),
    yaw: num,
    pitch: num,
    health: fc.integer({ min: 1, max: 100 }),
    stamina: fc.integer({ min: 0, max: 100 }),
    interactTarget: fc.constantFrom(null, 'bone' as const),
  }),
  inventory: fc.record({
    slots: fc.array(
      fc.record({
        item: fc.constantFrom('bone' as const, 'cloth' as const),
        qty: fc.integer({ min: 1, max: 10 }),
      }),
      { maxLength: 12 },
    ),
    keyItems: fc.subarray(['rusted-crypt-key', 'bone-whistle'] as const),
    relics: fc.subarray(relicIds),
    hotbar: fc.tuple(
      fc.constantFrom('rusty-shovel' as const, null),
      fc.constantFrom('bone-club' as const, null),
      fc.constant(null),
      fc.constant(null),
    ),
  }),
  mystery: fc
    .record({
      pages: fc.subarray([1, 2, 3, 4, 5] as PageNumber[]),
      clues: fc.subarray(['clue-a', 'clue-b', 'clue-c']),
      relics: fc.subarray(relicIds),
      gates: fc.record({
        'mausoleum-row': fc.boolean(),
        catacombs: fc.boolean(),
        ossuary: fc.boolean(),
      }),
      riteProgress: fc.integer({ min: 0, max: 45 }),
      craneRested: fc.boolean(),
    })
    .map((m) => ({
      ...m,
      pages: new Set(m.pages),
      clues: new Set(m.clues),
      relics: new Set(m.relics),
    })),
  chapel: fc.record({
    completedStages: fc
      .subarray(['barDoor', 'altarSave', 'bellWarning'] as const)
      .map((a) => [...a]),
    altarHealedToday: fc.boolean(),
    finalRiteActive: fc.boolean(),
  }),
  recipes: fc.subarray(['r-bone-club', 'r-bandage']),
  tutorial: fc.subarray([1, 2, 3, 4, 5, 6, 7] as TutorialStepId[]).map((a) => new Set(a)),
  introSeen: fc.boolean(),
  progression: fc.constant(defaultProgressionSave()),
  combat: fc.constant({
    firearms: { revolver: { magazine: 3 } },
    durability: { 'wood-axe': 10 },
    upgrades: ['up-axe-edge'],
    takenPickups: ['wood-axe'],
    doors: { built: true, front: [60, 20], vestry: [] },
  }),
}) as unknown as fc.Arbitrary<SaveState>

describe('saveGame', () => {
  it('round-trips any valid state through storage (Req 7.1, 7.2)', () => {
    fc.assert(
      fc.property(saveStateArb, (state) => {
        const storage = memoryStorage()
        expect(writeSave(storage, state)).toBe(true)
        expect(readSave(storage)).toEqual(state)
      }),
    )
  })

  it('writes a versioned file with Sets as arrays', () => {
    const state = { ...(fc.sample(saveStateArb, 1)[0] as SaveState), mystery: createMysteryState() }
    const file = toSaveFile(state)
    expect(file.version).toBe(SAVE_VERSION)
    expect(Array.isArray(file.mystery.pages)).toBe(true)
  })

  it('returns null and hides Continue for missing, corrupt or wrong-version saves (Req 7.3)', () => {
    const good = JSON.stringify(toSaveFile(fc.sample(saveStateArb, 1)[0] as SaveState))
    const bad = [
      undefined,
      '',
      '{not json',
      'null',
      '[]',
      JSON.stringify({ version: 99 }),
      good.replace('"version":1', '"version":2'),
      JSON.stringify({ ...JSON.parse(good), player: { health: 'lots' } }),
    ]
    for (const raw of bad) {
      const storage = memoryStorage(raw)
      expect(readSave(storage)).toBeNull()
      expect(hasValidSave(storage)).toBe(false)
    }
    expect(hasValidSave(memoryStorage(good))).toBe(true)
  })

  it('does not throw when storage is unavailable or throws', () => {
    const state = fc.sample(saveStateArb, 1)[0] as SaveState
    const throwing = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('quota')
      },
    }
    expect(writeSave(throwing, state)).toBe(false)
    expect(readSave(throwing)).toBeNull()
    expect(writeSave(undefined, state)).toBe(false)
    expect(readSave(undefined)).toBeNull()
  })
})

const RUNS = { numRuns: 100 }
const junk = fc.anything()

describe('saveGame new fields', () => {
  it('Feature: 06-clarity-and-hud, Property 28: save round trip with new fields', () => {
    fc.assert(
      fc.property(saveStateArb, (s) => {
        expect(fromSaveFile(JSON.parse(JSON.stringify(toSaveFile(s))))).toEqual(s)
      }),
      RUNS,
    )
  })

  it('Feature: 06-clarity-and-hud, Property 29: old saves load with defaults', () => {
    fc.assert(
      fc.property(saveStateArb, (s) => {
        const old = JSON.parse(JSON.stringify(toSaveFile(s)))
        delete old.tutorial
        delete old.introSeen
        const loaded = fromSaveFile(old)
        expect(loaded).not.toBeNull()
        expect(loaded?.tutorial.size).toBe(0)
        expect(loaded?.introSeen).toBe(s.world.nightNumber > 1 || s.world.phase !== 'day')
        expect(loaded?.introSeen).toBe(hasPassedFirstDay(s.world))
      }),
      RUNS,
    )
  })

  it('Feature: 06-clarity-and-hud, Property 30: corrupt saves are rejected safely', () => {
    fc.assert(
      fc.property(saveStateArb, fc.string(), (s, text) => {
        // Arbitrary text never throws and is never a valid save.
        expect(readSave(memoryStorage(text))).toBeNull()
        // Wrongly typed existing field.
        const broken = JSON.parse(JSON.stringify(toSaveFile(s)))
        expect(readSave(memoryStorage(JSON.stringify({ ...broken, world: 'x' })))).toBeNull()
      }),
      RUNS,
    )
    fc.assert(
      fc.property(saveStateArb, junk, junk, (s, t, i) => {
        const file = JSON.parse(JSON.stringify(toSaveFile(s)))
        file.tutorial = t
        file.introSeen = i
        const loaded = fromSaveFile(
          JSON.parse(JSON.stringify({ ...file, tutorial: t, introSeen: i })),
        )
        expect(loaded).not.toBeNull()
        for (const step of loaded?.tutorial ?? []) expect([1, 2, 3, 4, 5, 6, 7]).toContain(step)
        if (typeof i !== 'boolean') expect(loaded?.introSeen).toBe(hasPassedFirstDay(s.world))
      }),
      RUNS,
    )
  })

  it('keeps SAVE_VERSION at 1 and always writes both fields', () => {
    const s = fc.sample(saveStateArb, 1)[0] as SaveState
    const file = toSaveFile({ ...s, tutorial: undefined, introSeen: undefined })
    expect(SAVE_VERSION).toBe(1)
    expect(file.tutorial).toEqual([])
    expect(typeof file.introSeen).toBe('boolean')
  })
})
