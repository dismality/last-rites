// Process and structure rules for spec 08 (Req 14.1, 14.2, 14.3, 14.5). They guard the
// architecture rules in .kiro/steering/tech.md, not game behaviour.
//   1. every file in src/game/systems/ has a matching *.test.ts (spec 08 files named explicitly)
//   2. nothing under src/game/ imports React, three.js or Howler
//   3. the spec 08 systems hold no unnamed balance literal beyond 0, 1, 2 and indices
//   4. this spec adds no .ogg, .mp3 or .glb file
//   5. PROGRESSION_PERSISTED and the Retry snapshot cover the same fields

import { describe, expect, it } from 'vitest'
import { PROGRESSION_PERSISTED, captureProgressionSave } from '../src/game/state/progressionPersistence'
import { progressionSnapshot } from '../src/game/state/retryNight'
import { defaultProgressionSave } from '../src/game/systems/progressionSave'

// No node:fs: the app tsconfig has no node types, so sources are read as raw text via Vite.
const raw = (g: Record<string, unknown>): Record<string, string> => g as Record<string, string>
const GAME_FILES: Record<string, string> = Object.fromEntries(
  Object.entries(
    raw(import.meta.glob('../src/game/**/*.{ts,tsx}', { eager: true, query: '?raw', import: 'default' })),
  ).map(([k, v]) => [k.replace(/^\.\.\//, ''), v]),
)
const SYSTEM_PREFIX = 'src/game/systems/'
const SYSTEM_FILES = Object.keys(GAME_FILES).filter(
  (p) => p.startsWith(SYSTEM_PREFIX) && !p.slice(SYSTEM_PREFIX.length).includes('/'),
)
const isSource = (p: string): boolean => /\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p)

/** Removes comments, strings and template text so only code is scanned. Keeps line breaks. */
function stripNonCode(src: string): string {
  let out = ''
  let i = 0
  while (i < src.length) {
    const c = src[i]
    const n = src[i + 1]
    if (c === '/' && n === '/') {
      while (i < src.length && src[i] !== '\n') i++
    } else if (c === '/' && n === '*') {
      i += 2
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] === '\n') out += '\n'
        i++
      }
      i += 2
    } else if (c === '"' || c === "'" || c === '`') {
      const quote = c
      i++
      while (i < src.length && src[i] !== quote) {
        if (src[i] === '\\') i++
        if (src[i] === '\n') out += '\n'
        i++
      }
      i++
      out += '""'
    } else {
      out += c
      i++
    }
  }
  return out
}

/** The systems this spec added. Named so a deleted file or test fails loudly. */
const SPEC_08_SYSTEMS = [
  'dawnUpgrades',
  'score',
  'coins',
  'merchant',
  'contracts',
  'modes',
  'endless',
  'achievements',
  'musicLayer',
  'musicMixer',
  'scareSilence',
  'storm',
  'stormLight',
  'progressionSave',
  'digDuration',
  'waveDirection',
] as const

describe('process rule: every system has a test', () => {
  it('has a matching *.test.ts for each file in src/game/systems/', () => {
    const files = SYSTEM_FILES.filter(isSource)
    const missing = files.filter((f) => !SYSTEM_FILES.includes(f.replace(/\.ts$/, '.test.ts')))
    expect(missing).toEqual([])
  })

  it('has both a source file and a test for every spec 08 system', () => {
    for (const name of SPEC_08_SYSTEMS) {
      expect(SYSTEM_FILES, `${name}.ts`).toContain(`${SYSTEM_PREFIX}${name}.ts`)
      expect(SYSTEM_FILES, `${name}.test.ts`).toContain(`${SYSTEM_PREFIX}${name}.test.ts`)
    }
  })
})

describe('process rule: game logic stays pure', () => {
  const FORBIDDEN = /^(react|react-dom|three|howler|@react-three\/.+|three\/.+|react\/.+)$/

  it('imports no React, three.js or Howler under src/game/', () => {
    const offenders: string[] = []
    const importRe = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]/g
    for (const [file, code] of Object.entries(GAME_FILES)) {
      for (const m of code.matchAll(importRe)) {
        if (FORBIDDEN.test(m[1])) offenders.push(`${file} imports ${m[1]}`)
      }
    }
    expect(offenders).toEqual([])
  })
})

describe('process rule: no balance literals in the spec 08 systems', () => {
  const CHECKED = [
    'score',
    'coins',
    'merchant',
    'contracts',
    'modes',
    'endless',
    'dawnUpgrades',
    'storm',
    'musicLayer',
    'musicMixer',
    'scareSilence',
  ]
  const numRe = /(?<![\w.$])(\d+\.\d+|\d+|\.\d+)(?:e[+-]?\d+)?(?![\w.])/gi

  it('uses only 0, 1, 2, indices and named constants', () => {
    const offenders: string[] = []
    for (const name of CHECKED) {
      const file = `${SYSTEM_PREFIX}${name}.ts`
      expect(GAME_FILES[file], file).toBeDefined()
      stripNonCode(GAME_FILES[file]).split('\n').forEach((line, idx) => {
        // A named module-level constant is the sanctioned place for a local number.
        if (/^\s*(export\s+)?const\s+[A-Z][A-Z0-9_]*\b/.test(line)) return
        for (const m of line.matchAll(numRe)) {
          const v = Number(m[0])
          if (v === 0 || v === 1 || v === 2) continue
          const before = line.slice(0, m.index)
          const after = line.slice((m.index ?? 0) + m[0].length)
          if (/\[\s*$/.test(before) && /^\s*\]/.test(after)) continue // array index
          offenders.push(`${file}:${idx + 1} uses ${m[0]}`)
        }
      })
    }
    expect(offenders).toEqual([])
  })
})

describe('structure rule: this spec adds no binary assets', () => {
  /** Every .ogg, .mp3 and .glb under public/assets when spec 08 started (paths below assets/). */
  const ALLOWED = new Set(
    (
      'models/enemies/zombie-brute.glb models/enemies/zombie.glb models/items/bone-whistle.glb ' +
      'models/items/burial-shroud.glb models/items/childs-locket.glb models/items/crane-rosary.glb ' +
      'models/items/iron-ossuary-key.glb models/items/reliquary-heart.glb models/items/rusted-crypt-key.glb ' +
      'models/items/sextons-bell-clapper.glb models/scene/graveyard.glb'
    ).split(' '),
  )
  const WORLD = (
    'altar-stone altar-wood bench-damaged bench border-pillar brick-wall-curve-small brick-wall-curve ' +
    'brick-wall-end brick-wall candle-multiple candle coffin-old coffin column-large cross-column cross-wood ' +
    'cross crypt-a crypt-b crypt-door crypt-large-door crypt-large-roof crypt-large crypt-small-roof ' +
    'crypt-small crypt debris-wood debris detail-bowl detail-chalice detail-plate fence-damaged fence-gate ' +
    'fence fire-basket grave-border grave gravestone-bevel gravestone-broken gravestone-cross-large ' +
    'gravestone-cross gravestone-debris gravestone-decorative gravestone-roof gravestone-round ' +
    'gravestone-wide iron-fence-bar iron-fence-border-column iron-fence-border-curve iron-fence-border-gate ' +
    'iron-fence-border iron-fence-curve iron-fence-damaged iron-fence lantern-candle lantern-glass ' +
    'lightpost-all lightpost-double lightpost-single pillar-large pillar-obelisk pillar-small pillar-square ' +
    'pine-crooked pine-fall-crooked pine-fall pine road rocks-tall rocks shovel-dirt shovel ' +
    'stone-wall-column stone-wall-curve stone-wall-damaged stone-wall trunk-long trunk urn-round urn-square'
  ).split(' ')
  for (const w of WORLD) ALLOWED.add(`models/world/${w}.glb`)

  it('has only the recorded .ogg, .mp3 and .glb files', () => {
    const found = Object.keys(import.meta.glob('../public/assets/**/*.{ogg,mp3,glb}'))
      .map((p) => p.replace('../public/assets/', ''))
      .sort()
    expect(found.filter((p) => !ALLOWED.has(p))).toEqual([])
  })
})

describe('structure rule: Save and Retry share one progression field list', () => {
  it('PROGRESSION_PERSISTED, the save defaults and the Retry snapshot name the same fields', () => {
    const listed = [...PROGRESSION_PERSISTED].sort()
    expect(Object.keys(defaultProgressionSave()).sort()).toEqual(listed)
    expect(Object.keys(captureProgressionSave()).sort()).toEqual(listed)
    expect(Object.keys(progressionSnapshot.getState()).sort()).toEqual(listed)
  })
})
