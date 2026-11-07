import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { isGateLocked } from './gates'
import { buildFenceSegments, generateHeadstones, GROUNDS_HALF, HEADSTONE } from '../../data/cemeteryLayout'
import type { KeyItemId } from '../types'

describe('isGateLocked', () => {
  it('is locked without the matching key', () => {
    expect(isGateLocked('mausoleum-row', [])).toBe(true)
    expect(isGateLocked('mausoleum-row', ['bone-whistle'])).toBe(true)
    expect(isGateLocked('catacombs', ['rusted-crypt-key'])).toBe(true)
  })

  it('unlocks with the matching key', () => {
    expect(isGateLocked('mausoleum-row', ['rusted-crypt-key'])).toBe(false)
    expect(isGateLocked('catacombs', ['bone-whistle'])).toBe(false)
  })

  it('holding unrelated keys never changes the result', () => {
    const keys: KeyItemId[] = ['parish-ledger', 'iron-ossuary-key']
    fc.assert(
      fc.property(fc.subarray(keys), (held) => isGateLocked('catacombs', held) === true)
    )
  })
})

describe('cemetery layout', () => {
  it('scatters the full headstone count inside the grounds, deterministically', () => {
    const a = generateHeadstones()
    expect(a).toHaveLength(HEADSTONE.count)
    expect(generateHeadstones()).toEqual(a)
    for (const h of a) {
      expect(Math.abs(h.position[0])).toBeLessThan(GROUNDS_HALF)
      expect(Math.abs(h.position[2])).toBeLessThan(GROUNDS_HALF)
    }
  })

  it('leaves a gap in the fence at each corridor mouth', () => {
    const north = buildFenceSegments().filter((s) => s.axis === 'x' && s.fixed === -GROUNDS_HALF)
    const south = buildFenceSegments().filter((s) => s.axis === 'x' && s.fixed === GROUNDS_HALF)
    expect(north).toHaveLength(2)
    expect(south).toHaveLength(2)
  })
})
