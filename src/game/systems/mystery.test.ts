import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import {
  chooseEnding,
  collectPage,
  collectRelic,
  migrateEnding,
  createMysteryState,
  discoverClue,
  openGate,
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

  it('starts with the retired hold progress at 0 (the field only keeps old saves loading)', () => {
    expect(createMysteryState().riteProgress).toBe(0)
  })

  it('maps relic counts to endings', () => {
    expect(chooseEnding(5)).toBe('rest')
    // Uneasy Peace is retired: fewer than five relics is Taken.
    expect(chooseEnding(4)).toBe('taken')
    expect(chooseEnding(3)).toBe('taken')
    expect(chooseEnding(2)).toBe('taken')
    expect(chooseEnding(0)).toBe('taken')
  })
})

describe('chooseEnding properties', () => {
  const rank = { taken: 0, rest: 1 } as const

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

describe('migrateEnding', () => {
  it('maps the retired Uneasy Peace by relic count and keeps the others', () => {
    expect(migrateEnding(undefined, 5)).toBeUndefined()
    expect(migrateEnding('rest', 5)).toBe('rest')
    expect(migrateEnding('taken', 0)).toBe('taken')
    expect(migrateEnding('uneasy-peace', 4)).toBe('taken')
    expect(migrateEnding('uneasy-peace', 5)).toBe('rest')
  })
})
