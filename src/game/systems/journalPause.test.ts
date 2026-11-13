import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { Phase } from '../types'
import { escClosesOverlay, pausesSim } from './journalPause'

const phases = fc.constantFrom<Phase>('day', 'dusk', 'night', 'dawn')

describe('pausesSim', () => {
  it('Property 25: the journal pauses only by day', () => {
    // **Validates: Requirements 10.1, 10.2**
    fc.assert(
      fc.property(phases, fc.boolean(), (phase, open) => {
        expect(pausesSim(phase, open)).toBe(phase === 'day' && open)
        expect(escClosesOverlay(phase, open)).toBe(pausesSim(phase, open))
      }),
    )
  })

  it('examples', () => {
    expect(pausesSim('day', true)).toBe(true)
    expect(pausesSim('night', true)).toBe(false)
    expect(pausesSim('dusk', true)).toBe(false)
    expect(pausesSim('day', false)).toBe(false)
  })
})
