// Smoke test: verifies the vitest + fast-check pipeline works.
import * as fc from 'fast-check'
import { Phase } from '../src/game/types'

describe('scaffold', () => {
  it('fast-check property test runs', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), (n) => {
        return n >= 0 && n <= 100
      }),
    )
  })

  it('Phase type is defined', () => {
    const phase: Phase = 'day'
    expect(['day', 'dusk', 'night', 'dawn']).toContain(phase)
  })
})
