// Process rules for spec 07 (Req 24.1, 24.2): they guard the architecture rules in
// .kiro/steering/tech.md rather than game behaviour.
//   1. every file in src/game/systems/ has a matching *.test.ts
//   2. nothing under src/game/ imports React, three.js, Howler or the R3F family
//   3. systems/ holds no balance literal that equals a number in src/data/
//
// Rule 3 is a heuristic, so it is built not to flake: it reads source text (no timing, no
// randomness), ignores comments and strings, skips small and unit-conversion numbers, and
// every exception lives in LITERAL_ALLOWLIST with a written reason.

import { describe, expect, it } from 'vitest'

// No node:fs here: the app tsconfig has no node types, so sources are read through Vite's glob
// import as raw text, which also works under vitest.
const raw = (g: Record<string, unknown>): Record<string, string> => g as Record<string, string>
/** Every .ts/.tsx under src/game/, keyed by repo-relative path. */
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

describe('process rule: every system has a test', () => {
  it('has a matching *.test.ts for each file in src/game/systems/', () => {
    const files = SYSTEM_FILES.filter(isSource)
    const missing = files.filter((f) => !SYSTEM_FILES.includes(f.replace(/\.ts$/, '.test.ts')))
    expect(missing).toEqual([])
  })
})

describe('process rule: game logic stays pure', () => {
  const FORBIDDEN = /^(react|react-dom|three|howler|@react-three\/.+|three\/.+|react\/.+)$/

  it('imports no React, three.js, Howler or react-three package under src/game/', () => {
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

describe('process rule: no duplicated balance numbers in systems/', () => {
  /** Every finite number exported anywhere in src/data/, found by walking the module values. */
  async function dataNumbers(): Promise<Set<number>> {
    const modules = import.meta.glob('../src/data/*.ts', { eager: true }) as Record<
      string,
      Record<string, unknown>
    >
    const seen = new Set<number>()
    const visited = new WeakSet<object>()
    const visit = (v: unknown, depth: number): void => {
      if (typeof v === 'number') {
        if (Number.isFinite(v)) seen.add(v)
        return
      }
      if (depth > 6 || typeof v !== 'object' || v === null || visited.has(v)) return
      visited.add(v)
      for (const x of Object.values(v)) visit(x, depth + 1)
    }
    for (const [path, mod] of Object.entries(modules)) {
      if (/\.test\.ts$/.test(path)) continue
      for (const v of Object.values(mod)) visit(v, 0)
    }
    return seen
  }

  /** Too common to be a balance number: small integers, quarters and unit conversions. */
  const TRIVIAL = new Set<number>([
    0.25, 0.5, 0.75, 100, 1000, 60, 90, 180, 360, 255, 1024,
  ])
  const isTrivial = (v: number): boolean =>
    Math.abs(v) < 0.01 || (Number.isInteger(v) && Math.abs(v) <= 10) || TRIVIAL.has(v)

  /**
   * Documented exceptions: "file:value" with the reason it is not a duplicated balance number.
   * Keep this list short. A real balance number belongs in src/data/.
   */
  const ANIMATION = 'Animation or particle curve shaping; a presentation constant, not a balance number.'
  const LITERAL_ALLOWLIST: Readonly<Record<string, string>> = {
    'src/game/systems/ballistics.ts:0.9':
      'Picks a helper axis for the spread basis when the aim is nearly vertical; geometry, not balance.',
    'src/game/systems/objective.ts:11':
      'Rule number 11 of the objective table (an id the tracker returns), not a quantity.',
    'src/game/systems/skyTransition.ts:16':
      'Bit shift when unpacking a hex colour; a coincidence with a data value.',
    'src/game/systems/settings.ts:0.1':
      'Settings ranges and defaults are defined here, once; they are the accessibility rules, not enemy or weapon balance.',
    'src/game/systems/settings.ts:0.8': 'Brightness range minimum; see settings.ts:0.1.',
    'src/game/systems/settings.ts:1.4': 'Brightness range maximum; see settings.ts:0.1.',
    'src/game/systems/settings.ts:75': 'Default field of view; see settings.ts:0.1.',
    'src/game/systems/settings.ts:80': 'Default master and SFX volume; see settings.ts:0.1.',
    'src/game/systems/viewmodel.ts:0.2': ANIMATION,
    'src/game/systems/melee.ts:0.05': ANIMATION,
    'src/game/systems/melee.ts:0.3': ANIMATION,
    'src/game/systems/melee.ts:0.35': ANIMATION,
    'src/game/systems/melee.ts:0.06': ANIMATION,
    'src/game/systems/melee.ts:0.12': ANIMATION,
    'src/game/systems/melee.ts:0.9': ANIMATION,
    'src/game/systems/melee.ts:1.6': ANIMATION,
    'src/game/systems/melee.ts:0.4': ANIMATION,
    'src/game/systems/melee.ts:2.5': ANIMATION,
  }

  it('has no non-trivial numeric literal equal to a src/data/ value', async () => {
    const values = await dataNumbers()
    const numRe = /(?<![\w.$])(\d+\.\d+|\d+|\.\d+)(?:e[+-]?\d+)?(?![\w.])/gi
    const offenders: string[] = []
    for (const file of SYSTEM_FILES.filter(isSource)) {
      const code = stripNonCode(GAME_FILES[file])
      code.split('\n').forEach((line, idx) => {
        for (const m of line.matchAll(numRe)) {
          const v = Number(m[0])
          if (!Number.isFinite(v) || isTrivial(v) || !values.has(v)) continue
          // A named module-level constant is the sanctioned place for a local number.
          if (/^\s*(export\s+)?const\s+[A-Z][A-Z0-9_]*\b/.test(line)) continue
          const key = `${file}:${v}`
          if (key in LITERAL_ALLOWLIST) continue
          offenders.push(`${file}:${idx + 1} uses ${m[0]} (also in src/data/)`)
        }
      })
    }
    expect(offenders).toEqual([])
  })

  it('keeps every allowlist entry justified', () => {
    for (const [key, reason] of Object.entries(LITERAL_ALLOWLIST)) {
      expect(reason.trim().length, key).toBeGreaterThan(10)
    }
  })
})
