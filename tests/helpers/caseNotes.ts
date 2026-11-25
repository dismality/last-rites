// Test fixture: no story case links clues on the case board any more (each case is a chain of
// finds), but the linking rules are still the game's for any case that lists notes. These tests
// lend Case 3 three made-up deduction notes for the length of a test, then give them back.

import { afterEach, beforeEach } from 'vitest'
import { CASE_MAP, type DeductionNote } from '../../src/data/cases'

export const FIXTURE_NOTES: readonly DeductionNote[] = [
  { a: 'hymn-letters-below', b: 'hearse-cart-ruts', text: 'Below the chapel, then down the Row.', question: 'Where did the hymns send him?' },
  { a: 'hearse-pin-hasp', b: 'elias-unsent-letter', text: 'Pinned in, with his letter on him.', question: 'Who was behind the pinned door?' },
  { a: 'silas-handwriting', b: 'vane-receipt', text: 'One hand wrote both.', question: 'What else is in the careful hand?' },
]

/** Lends Case 3 the fixture notes in each test of the calling file. */
export function lendFixtureNotes(): void {
  const def = CASE_MAP['sealed-catacombs'] as { notes: readonly DeductionNote[] }
  let saved: readonly DeductionNote[] = []
  beforeEach(() => {
    saved = def.notes
    def.notes = FIXTURE_NOTES
  })
  afterEach(() => {
    def.notes = saved
  })
}
