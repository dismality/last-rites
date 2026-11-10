// Spec 09, B7: the examine panel shows a journal page's text, found from the examined item id.
import { describe, expect, it } from 'vitest'
import { JOURNAL_PAGES, journalPageForItem } from './journal'

describe('journalPageForItem', () => {
  it('maps every journal-page-N item to its page, with text to read', () => {
    for (const p of JOURNAL_PAGES) {
      const found = journalPageForItem(`journal-page-${p.id}`)
      expect(found).toBe(p)
      expect(found!.text.length).toBeGreaterThan(40)
    }
  })

  it('returns null for any other item', () => {
    for (const id of ['rusted-crypt-key', 'parish-ledger', 'journal-page-6', 'journal-page-', 'lamp-oil']) {
      expect(journalPageForItem(id)).toBeNull()
    }
  })
})
