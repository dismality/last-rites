import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { COLLAPSE_DUST_PUFFS, COLLAPSE_DUST_PUFFS_CALM } from '../../data/stages'
import { collapseLiving, collapsePuffCount } from './caseCollapse'
import { createEnemy, type AIEnemy, type AIState } from './enemyAI'

const make = (uid: string, type: 'shambler' | 'brute' | 'father-crane', state: AIState, x: number): AIEnemy => ({
  ...createEnemy(uid, type, { x, z: 2 }),
  state,
})

describe('collapseLiving', () => {
  it('turns every living zombie to dying at its own spot and reports it once', () => {
    const list = [make('a', 'shambler', 'chase', 1), make('b', 'brute', 'dormant', 5), make('c', 'shambler', 'dead', 9)]
    const r = collapseLiving(list)
    expect(r.enemies.map((e) => e.state)).toEqual(['dying', 'dying', 'dead'])
    expect(r.collapsed).toEqual([
      { x: 1, z: 2 },
      { x: 5, z: 2 },
    ])
  })

  it('leaves Father Crane and returns the same list when nothing is alive', () => {
    const list = [make('c', 'father-crane', 'chase', 0), make('d', 'shambler', 'dying', 3)]
    const r = collapseLiving(list)
    expect(r.enemies).toBe(list)
    expect(r.collapsed).toEqual([])
  })

  it('property: no living zombie is left, and none is added', () => {
    // Feature: 10-curse-stages, Property 1: Waves run exactly while the case is unsolved (collapse part)
    const states: AIState[] = ['rise', 'dormant', 'chase', 'lunge', 'attack', 'stagger', 'down', 'swell', 'dying', 'dead']
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...states), { maxLength: 20 }), (ss) => {
        const list = ss.map((s, i) => make(`z${i}`, 'shambler', s, i))
        const r = collapseLiving(list)
        expect(r.enemies).toHaveLength(list.length)
        expect(r.enemies.every((e) => e.state === 'dying' || e.state === 'dead')).toBe(true)
        expect(r.collapsed).toHaveLength(ss.filter((s) => s !== 'dying' && s !== 'dead').length)
      }),
      { numRuns: 100 },
    )
  })

  it('calm players get fewer puffs', () => {
    expect(collapsePuffCount(false)).toBe(COLLAPSE_DUST_PUFFS)
    expect(collapsePuffCount(true)).toBe(COLLAPSE_DUST_PUFFS_CALM)
    expect(COLLAPSE_DUST_PUFFS_CALM).toBeLessThan(COLLAPSE_DUST_PUFFS)
  })
})
