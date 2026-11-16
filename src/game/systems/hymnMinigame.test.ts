import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { filledCount, letterOfKey, moveTile, psalterRows, setTile, stepLetter } from './hymnMinigame'

describe('hymn tile keys (Req 15.4)', () => {
  it('moves between tiles without wrapping', () => {
    expect(moveTile(0, 'ArrowLeft')).toBe(0)
    expect(moveTile(4, 'ArrowRight')).toBe(4)
    expect(moveTile(2, 'ArrowRight')).toBe(3)
    expect(moveTile(2, 'Enter')).toBe(2)
  })

  it('steps letters with wrap, starting an empty tile at A or Z', () => {
    expect(stepLetter(null, 'ArrowUp')).toBe('A')
    expect(stepLetter(null, 'ArrowDown')).toBe('Z')
    expect(stepLetter('Z', 'ArrowUp')).toBe('A')
    expect(stepLetter('A', 'ArrowDown')).toBe('Z')
    expect(stepLetter('B', 'ArrowLeft')).toBe('B')
  })

  it('up then down returns to the same letter', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 25 }), (n) => {
        const l = String.fromCharCode(65 + n)
        expect(stepLetter(stepLetter(l, 'ArrowUp'), 'ArrowDown')).toBe(l)
      }),
    )
  })

  it('reads letter keys and sets one tile without touching the input', () => {
    expect(letterOfKey('KeyW')).toBe('W')
    expect(letterOfKey('Digit1')).toBeNull()
    const before = [null, 'E', null, null, null] as const
    const after = setTile(before, 0, 'B')
    expect(after).toEqual(['B', 'E', null, null, null])
    expect(before[0]).toBeNull()
    expect(filledCount(after)).toBe(2)
  })

  it('lists all 60 hymns for the psalter', () => {
    const rows = psalterRows()
    expect(rows).toHaveLength(60)
    expect(rows[0].n).toBe(1)
  })
})

import { HYMN_BOARD_POSITION, PSALTER_POSITION } from '../../data/chapelScenery'
import { CHAPEL_CENTER, CHAPEL } from '../../data/cemeteryLayout'
import { CHAPEL_CUPBOARD_POSITION } from '../../data/cemeteryLayout'
import { mergeRetry, freshCaseSave, sanitizeHymnTiles, sanitizeCaseSave } from './caseSave'

describe('hymn tiles save and props', () => {
  it('sanitises junk to empty tiles and round-trips letters', () => {
    expect(sanitizeHymnTiles('x')).toEqual([null, null, null, null, null])
    expect(sanitizeHymnTiles(['B', 'e', 7, 'LL', 'W', 'Z'])).toEqual(['B', null, null, null, 'W'])
    const save = freshCaseSave()
    save.cases['sealed-catacombs'].hymnTiles = ['B', 'E', null, null, null]
    expect(sanitizeCaseSave(JSON.parse(JSON.stringify(save))).cases['sealed-catacombs'].hymnTiles).toEqual(['B', 'E', null, null, null])
  })

  it('a retry keeps the draft with more tiles set', () => {
    const snap = freshCaseSave()
    const now = freshCaseSave()
    now.cases['sealed-catacombs'].hymnTiles = ['B', null, null, null, null]
    expect(mergeRetry(snap, now).cases['sealed-catacombs'].hymnTiles[0]).toBe('B')
  })

  it('the psalter lies on the cupboard shelf, clear of the revolver, and the board is inside the chapel', () => {
    expect(PSALTER_POSITION[1]).toBe(CHAPEL_CUPBOARD_POSITION[1])
    const dz = Math.abs(PSALTER_POSITION[2] - CHAPEL_CUPBOARD_POSITION[2])
    expect(dz).toBeGreaterThanOrEqual(0.3)
    expect(dz).toBeLessThanOrEqual(0.5)
    expect(Math.abs(HYMN_BOARD_POSITION[0] - CHAPEL_CENTER[0])).toBeLessThanOrEqual(CHAPEL.halfX + 0.1)
  })
})
