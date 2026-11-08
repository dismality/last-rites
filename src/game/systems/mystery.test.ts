import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import {
  RITE_DURATION,
  chooseEnding,
  collectPage,
  collectRelic,
  createMysteryState,
  discoverClue,
  openGate,
  tickRite,
} from './mystery'

describe('mystery state', () => {
  it('collects pages, clues and relics immutably and idempotently', () => {
    const s0 = createMysteryState()
    const s1 = collectRelic(discoverClue(collectPage(s0, 3), 'marsh'), 'crane-rosary')
    expect(s0.pages.size).toBe(0)
    expect(s1.pages.has(3)).toBe(true)
    expect(s1.clues.has('marsh')).toBe(true)
    expect(collectPage(s1, 3)).toBe(s1)
  })

  it('gate opening needs the right key', () => {
    const s0 = createMysteryState()
    expect(openGate(s0, 'mausoleum-row', { keyItems: ['bone-whistle'] })).toBe(s0)
    expect(openGate(s0, 'mausoleum-row', { keyItems: ['rusted-crypt-key'] }).gates['mausoleum-row']).toBe(true)
    expect(openGate(s0, 'catacombs', { keyItems: ['bone-whistle'] }).gates.catacombs).toBe(true)
    expect(openGate(s0, 'ossuary', { keyItems: ['rusted-crypt-key'] }).gates.ossuary).toBe(false)
    expect(openGate(s0, 'ossuary', { keyItems: ['iron-ossuary-key'] }).gates.ossuary).toBe(true)
  })

  it('rite progress pauses on release and clamps at 45 s', () => {
    let s = tickRite(createMysteryState(), 10, true)
    expect(s.riteProgress).toBe(10)
    s = tickRite(s, 5, false)
    expect(s.riteProgress).toBe(10)
    s = tickRite(s, 100, true)
    expect(s.riteProgress).toBe(RITE_DURATION)
  })

  it('maps relic counts to endings', () => {
    expect(chooseEnding(5)).toBe('rest')
    expect(chooseEnding(4)).toBe('uneasy-peace')
    expect(chooseEnding(3)).toBe('uneasy-peace')
    expect(chooseEnding(2)).toBe('taken')
    expect(chooseEnding(0)).toBe('taken')
  })
})

describe('chooseEnding properties', () => {
  const rank = { taken: 0, 'uneasy-peace': 1, rest: 2 } as const

  // **Validates: Requirements 5.3, 5.4, 5.5**
  it('is total: always returns a valid ending', () => {
    fc.assert(
      fc.property(fc.nat(1000), (n) => {
        expect(Object.keys(rank)).toContain(chooseEnding(n))
      }),
    )
  })

  // **Validates: Requirements 5.3, 5.4, 5.5**
  it('is monotonic in relic count', () => {
    fc.assert(
      fc.property(fc.nat(1000), fc.nat(1000), (a, b) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a]
        expect(rank[chooseEnding(lo)]).toBeLessThanOrEqual(rank[chooseEnding(hi)])
      }),
    )
  })
})
