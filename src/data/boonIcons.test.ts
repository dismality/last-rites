import { describe, expect, it } from 'vitest'
import { iconUrl } from './assets'
import { DAWN_UPGRADES } from './dawnUpgrades'

// Directory listing through Vite: keys only, no file is loaded.
const onDisk = new Set(
  Object.keys(import.meta.glob('/public/assets/icons/boons/*.png', { query: '?url' })).map((p) =>
    p.replace('/public', ''),
  ),
)

describe('boon icons', () => {
  it('every dawn upgrade has an icon file on disk', () => {
    const missing = DAWN_UPGRADES.filter((u) => !onDisk.has(iconUrl('boon', u.id))).map((u) => u.id)
    expect(missing).toEqual([])
  })

  it('has no stray icon without an upgrade', () => {
    const ids = new Set(DAWN_UPGRADES.map((u) => iconUrl('boon', u.id)))
    expect([...onDisk].filter((u) => !ids.has(u))).toEqual([])
  })
})
