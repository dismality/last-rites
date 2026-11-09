import { describe, expect, it } from 'vitest'
import { CONTRACTS, CONTRACTS_PER_DAWN, MELEE_SOURCES, UNHURT_MAX_DAMAGE } from './contracts'

describe('contract data (§12)', () => {
  it('has the 8 contracts with bible goals and rewards', () => {
    expect(CONTRACTS.map((c) => [c.id, c.goal, c.reward])).toEqual([
      ['c-dig-3', 3, 15],
      ['c-shotgun-5', 5, 20],
      ['c-revolver-head-3', 3, 20],
      ['c-melee-10', 10, 15],
      ['c-wailer-2', 2, 20],
      ['c-boards-3', 3, 10],
      ['c-gather-8', 8, 10],
      ['c-unhurt', 1, 30],
    ])
  })

  it('carries the requirements that make a contract impossible', () => {
    const req = (id: string) => CONTRACTS.find((c) => c.id === id)?.req
    expect(req('c-shotgun-5')).toEqual({ weapon: 'shotgun' })
    expect(req('c-revolver-head-3')).toEqual({ weapon: 'revolver' })
    expect(req('c-boards-3')).toEqual({ barricade: true })
    expect(req('c-wailer-2')).toEqual({ minWailersNextNight: 2 })
    expect(CONTRACTS.filter((c) => c.req)).toHaveLength(4)
  })

  it('has the dealing constants', () => {
    expect(CONTRACTS_PER_DAWN).toBe(2)
    expect(UNHURT_MAX_DAMAGE).toBe(50)
    expect([...MELEE_SOURCES]).toEqual(['melee', 'heavy'])
  })
})
