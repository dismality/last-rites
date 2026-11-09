import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { ACHIEVEMENTS } from '../../data/achievements'
import type { AchievementId } from '../types'
import {
  evaluateAchievements,
  parseUnlocked,
  queueToasts,
  serializeUnlocked,
  type AchievementFacts,
  type ToastItem,
} from './achievements'

const ids = ACHIEVEMENTS.map((a) => a.id)
const idSet = fc.subarray(ids)

const facts = fc.record({
  nightsSurvived: fc.integer({ min: 0, max: 6 }),
  digs: fc.integer({ min: 0, max: 15 }),
  nightHeadshotKills: fc.integer({ min: 0, max: 15 }),
  clearHp: fc.option(fc.integer({ min: 1, max: 100 }), { nil: null }),
  bestCombo: fc.double({ min: 1, max: 3, noNaN: true }),
  boardsNailed: fc.integer({ min: 0, max: 30 }),
  pagesRead: fc.integer({ min: 0, max: 5 }),
  relics: fc.integer({ min: 0, max: 5 }),
  craneRested: fc.boolean(),
  ending: fc.constantFrom('rest', 'uneasy-peace', 'taken', null),
  endlessNight: fc.integer({ min: 0, max: 12 }),
  coinsSpent: fc.integer({ min: 0, max: 150 }),
}) as fc.Arbitrary<AchievementFacts>

const toast = (id: AchievementId): ToastItem => ({ id, name: id })

describe('achievements', () => {
  it('unlocks Close Shave only at 10 HP or less on a clear', () => {
    const base = {
      nightsSurvived: 0, digs: 0, nightHeadshotKills: 0, bestCombo: 1, boardsNailed: 0,
      pagesRead: 0, relics: 0, craneRested: false, ending: null, endlessNight: 0, coinsSpent: 0,
    }
    expect(evaluateAchievements([], { ...base, clearHp: 10 })).toEqual(['a-close-shave'])
    expect(evaluateAchievements([], { ...base, clearHp: 11 })).toEqual([])
    expect(evaluateAchievements([], { ...base, clearHp: null })).toEqual([])
  })

  it('parseUnlocked handles null, bad JSON and wrong types', () => {
    expect(parseUnlocked(null)).toEqual([])
    expect(parseUnlocked('{oops')).toEqual([])
    expect(parseUnlocked('{"a":1}')).toEqual([])
    expect(parseUnlocked('["a-rest",3,"nope"]')).toEqual(['a-rest'])
  })

  /** **Validates: Requirements 8.9, 8.11** */
  it('Property 23: storage round trip and sanitising', () => {
    fc.assert(
      fc.property(idSet, (set) => {
        expect(new Set(parseUnlocked(serializeUnlocked(set)))).toEqual(new Set(set))
      }),
    )
    fc.assert(
      fc.property(fc.string(), (text) => {
        const out = parseUnlocked(text)
        expect(out.every((id) => ids.includes(id))).toBe(true)
      }),
    )
    fc.assert(
      fc.property(fc.array(fc.oneof(fc.constantFrom(...ids), fc.string(), fc.integer())), (arr) => {
        const out = parseUnlocked(JSON.stringify(arr))
        expect(new Set(out)).toEqual(new Set(arr.filter((v) => ids.includes(v as AchievementId))))
      }),
    )
  })

  /** **Validates: Requirements 8.2, 8.4, 8.12, 8.13** */
  it('Property 24: unlock once, never shrink, toast queue capped', () => {
    fc.assert(
      fc.property(idSet, fc.array(facts, { minLength: 1, maxLength: 6 }), (start, seq) => {
        let unlocked: AchievementId[] = [...start]
        for (const f of seq) {
          const fresh = evaluateAchievements(unlocked, f)
          // table order, none already unlocked
          const order = fresh.map((id) => ids.indexOf(id))
          expect([...order].sort((a, b) => a - b)).toEqual(order)
          expect(fresh.some((id) => unlocked.includes(id))).toBe(false)
          const next = [...unlocked, ...fresh]
          expect(evaluateAchievements(next, f)).toEqual([])
          expect(unlocked.every((id) => next.includes(id))).toBe(true)
          unlocked = next
        }
      }),
    )
    fc.assert(
      fc.property(idSet, (batch) => {
        const add = batch.map(toast)
        const { visible, queued } = queueToasts([], [], add)
        expect(visible.length).toBeLessThanOrEqual(3)
        expect([...visible, ...queued]).toEqual(add)
      }),
    )
  })
})
