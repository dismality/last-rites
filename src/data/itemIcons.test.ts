import { describe, expect, it } from 'vitest'
import { ITEM_ICON_URLS, MISSING_ICON_URL } from './assets'
import { ITEMS } from './items'

// Directory listing through Vite: keys only, no file is loaded.
const onDisk = new Set(
  Object.keys(import.meta.glob('/public/assets/icons/items/*.png', { query: '?url' })).map(
    (p) => p.replace('/public', ''),
  ),
)

describe('item icons', () => {
  it('has an icon entry for every item', () => {
    expect(Object.keys(ITEM_ICON_URLS).sort()).toEqual(ITEMS.map((i) => i.id).sort())
  })

  it('every icon points at a file on disk, or at the named placeholder', () => {
    const missing = ITEMS.filter((i) => {
      const url = ITEM_ICON_URLS[i.id]
      return url !== MISSING_ICON_URL && !onDisk.has(url)
    }).map((i) => i.id)
    expect(missing).toEqual([])
  })

  it('lists the items still using the placeholder (none while art is complete)', () => {
    const placeholders = ITEMS.filter((i) => ITEM_ICON_URLS[i.id] === MISSING_ICON_URL).map((i) => i.id)
    expect(placeholders).toEqual([])
  })

  it('shares one icon across the five journal pages', () => {
    const urls = new Set([1, 2, 3, 4, 5].map((n) => ITEM_ICON_URLS[`journal-page-${n}` as 'journal-page-1']))
    expect(urls.size).toBe(1)
  })
})
