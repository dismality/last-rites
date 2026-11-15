import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { isJournalPage, mergeKept } from './retryKeep'

describe('retryKeep', () => {
  it('recognises journal page key items only', () => {
    expect(isJournalPage('journal-page-3')).toBe(true)
    expect(isJournalPage('journal-page-6')).toBe(false)
    expect(isJournalPage('bone-whistle')).toBe(false)
  })

  it('keeps snapshot order and appends what was found later', () => {
    expect(mergeKept(['a', 'b'], ['b', 'c'])).toEqual(['a', 'b', 'c'])
  })

  // Validates: Requirements 10.6, 12.8 (a Retry never un-finds anything)
  it('property: the result holds every snapshot and kept entry once', () => {
    fc.assert(
      fc.property(fc.array(fc.string()), fc.array(fc.string()), (snap, kept) => {
        const out = mergeKept(snap, kept)
        expect(new Set(out).size).toBe(out.length)
        for (const x of [...snap, ...kept]) expect(out).toContain(x)
      }),
    )
  })
})
