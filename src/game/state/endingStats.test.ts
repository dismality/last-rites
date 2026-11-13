import fc from 'fast-check'
import { beforeEach, describe, expect, it } from 'vitest'
import { ENEMIES, type EnemyId } from '../../data/enemies'
import { recordKill, summaryRows } from '../systems/runStats'
import { useEndingStore } from './endingStore'
import { useProgressionStore } from './progressionStore'

const IDS: EnemyId[] = ENEMIES.map((e) => e.id)

describe('stats live in progressionStore', () => {
  beforeEach(() => {
    useProgressionStore.getState().reset()
    useEndingStore.getState().reset()
  })

  it('the ending store no longer holds stats', () => {
    expect('stats' in useEndingStore.getState()).toBe(false)
  })

  it('zombiesBanished equals the sum of kills after any run of kills', () => {
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...IDS), { maxLength: 40 }), (kills) => {
        let s = useProgressionStore.getState().stats
        for (const id of kills) s = recordKill(s, id)
        const sum = Object.values(s.kills).reduce((a, b) => a + b, 0)
        expect(s.zombiesBanished).toBe(sum)
      }),
    )
  })

  it('the ending summary still lists its earlier rows from the progression stats', () => {
    useProgressionStore.getState().patch({
      stats: recordKill(useProgressionStore.getState().stats, 'shambler'),
    })
    useEndingStore.getState().surviveNight(2)
    useEndingStore.getState().beginEnding('rest')
    const rows = summaryRows(useProgressionStore.getState().stats, 3, 4, 10)
    expect(rows.map((r) => r.label)).toEqual([
      'Nights survived',
      'Zombies banished',
      'Relics',
      'Clues found',
    ])
    expect(rows[0].value).toBe('3 of 3')
    expect(rows[1].value).toBe('1')
  })
})
