import { describe, expect, it } from 'vitest'
import { iconUrl, type IconIds, type IconKind } from './assets'
import { COMPASS_MARK_ID, COMPASS_MARKERS, type CompassMarkerKind } from './compass'
import { DAWN_UPGRADES } from './dawnUpgrades'
import { LANDMARKS } from './mapLandmarks'
import { ACTION_RUNE, type InteractAction } from '../game/systems/interaction'
import { markDrawChoice } from '../ui/markImages'

// Directory listing through Vite: keys only, no file is loaded.
const onDisk = new Set(
  Object.keys(import.meta.glob('/public/assets/icons/**/*.png', { query: '?url' })).map((p) =>
    p.replace('/public', ''),
  ),
)

const missing = <K extends IconKind>(kind: K, ids: readonly IconIds[K][]): string[] =>
  ids.map((id) => iconUrl(kind, id)).filter((u) => !onDisk.has(u))

describe('rune and mark image files', () => {
  it('every interaction action has a rune image', () => {
    expect(missing('interact-rune', Object.keys(ACTION_RUNE) as InteractAction[])).toEqual([])
  })

  it('every dawn upgrade has a boon icon and a boon rune', () => {
    const ids = DAWN_UPGRADES.map((u) => u.id)
    expect(missing('boon', ids)).toEqual([])
    expect(missing('boon-rune', ids)).toEqual([])
  })

  it('every compass marker has a light mark', () => {
    const kinds = Object.keys(COMPASS_MARKERS) as CompassMarkerKind[]
    expect(missing('mark-light', kinds.map((k) => COMPASS_MARK_ID[k]))).toEqual([])
  })

  it('every journal map landmark kind, the player and the extra marks have a dark mark', () => {
    const kinds = [...new Set(LANDMARKS.map((l) => l.kind))]
    expect(missing('mark-dark', [...kinds, 'player', 'objective', 'hut', 'merchant', 'graves'])).toEqual([])
  })

  it('has a light and a dark file for every mark', () => {
    const marks = [...onDisk].filter((u) => u.startsWith('/assets/icons/marks/'))
    const base = new Set(marks.map((u) => u.replace(/-(light|dark)\.png$/, '')))
    for (const b of base) {
      expect(onDisk.has(`${b}-light.png`) && onDisk.has(`${b}-dark.png`), b).toBe(true)
    }
  })
})

describe('mark fallback choice', () => {
  it('draws the image only once it has loaded', () => {
    expect(markDrawChoice('loaded')).toBe('image')
    expect(markDrawChoice('loading')).toBe('glyph')
    expect(markDrawChoice('error')).toBe('glyph')
  })
})
