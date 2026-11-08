import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { CLUE_MAP } from '../../data/clues'
import { CLUE_SPOTS, TOMBSTONES, TOMBSTONE_MAP } from '../../data/tombstones'
import type { KeyItemId } from '../types'
import { canDiscoverClue, isWrongGrave, readTombstone } from './tombstones'

const withLedger = { keyItems: ['parish-ledger'] as KeyItemId[] }
const without = { keyItems: [] as KeyItemId[] }

describe('tombstone reading', () => {
  it('marks a ledger-dated stone as a wrong grave only when the ledger is held', () => {
    expect(isWrongGrave(TOMBSTONE_MAP.marsh, withLedger)).toBe(true)
    expect(isWrongGrave(TOMBSTONE_MAP.marsh, without)).toBe(false)
  })

  it('does not mark stones whose dates are not in the ledger', () => {
    expect(isWrongGrave(TOMBSTONE_MAP.pell, withLedger)).toBe(false)
    expect(isWrongGrave(TOMBSTONE_MAP['crane-plaque'], withLedger)).toBe(false)
  })

  it('records the stone clue always and the wrong-grave clue with the ledger', () => {
    expect(readTombstone(TOMBSTONE_MAP.marsh, without).clueIds).toEqual(['clue-marsh-stone'])
    expect(readTombstone(TOMBSTONE_MAP.marsh, withLedger).clueIds).toEqual([
      'clue-marsh-stone',
      'clue-wrong-grave-marsh',
    ])
  })

  it('gates ledger clues on the ledger', () => {
    expect(canDiscoverClue('clue-ledger-week', without)).toBe(false)
    expect(canDiscoverClue('clue-ledger-week', withLedger)).toBe(true)
    expect(canDiscoverClue('clue-hut-boots', without)).toBe(true)
  })
})

describe('placed clues', () => {
  it('places at least six clues across the three zones, all defined', () => {
    for (const s of CLUE_SPOTS) expect(CLUE_MAP[s.clueId]).toBeDefined()
    const placed = new Set([
      ...CLUE_SPOTS.map((s) => s.clueId),
      ...TOMBSTONES.flatMap((t) => [t.clueId, t.wrongGraveClueId].filter(Boolean) as string[]),
    ])
    expect(placed.size).toBeGreaterThanOrEqual(6)
    const zones = new Set([...placed].map((id) => CLUE_MAP[id].zone))
    expect(zones.has('grounds') && zones.has('mausoleum-row') && zones.has('catacombs')).toBe(true)
  })

  it('places every defined clue somewhere', () => {
    const placed = new Set([
      ...CLUE_SPOTS.map((s) => s.clueId),
      ...TOMBSTONES.flatMap((t) => [t.clueId, t.wrongGraveClueId].filter(Boolean) as string[]),
    ])
    for (const id of Object.keys(CLUE_MAP)) expect(placed.has(id)).toBe(true)
  })

  it('never reports a wrong grave without the ledger, for any stone', () => {
    fc.assert(
      fc.property(fc.constantFrom(...TOMBSTONES), (t) => {
        expect(readTombstone(t, without).wrongGrave).toBe(false)
      }),
    )
  })
})
