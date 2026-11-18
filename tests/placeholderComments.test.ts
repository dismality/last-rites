import { describe, expect, it } from 'vitest'
import { LOOK_MESH_PLACEHOLDERS, PLACEHOLDERS } from '../src/data/placeholders'

// Spec 11 Req 8.16 (design bible §14, "Waiting list and placeholders"): every placeholder use in
// src/ carries a `// PLACEHOLDER: <path>` comment naming a declared art file, and model paths are
// written only in data/assets.ts, so the Waiting_List and the registry cannot drift apart.

const SOURCES = import.meta.glob<string>('../src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true })
const files = Object.entries(SOURCES)
  .filter(([p]) => !/\.test\.tsx?$/.test(p))
  .map(([p, text]) => ({ path: p.replace('../', ''), text }))

const DECLARED = new Set([...PLACEHOLDERS.map((r) => r.path), ...LOOK_MESH_PLACEHOLDERS.map((r) => r.path)])
/** A path mark (older prose marks such as AltarRite's predate spec 11 and name no file). */
const MARK = /\/\/ PLACEHOLDER: (\/[^\s`]+)/g
/** The component itself, and the files that only describe the rule. */
const DEFINES = new Set(['src/scene/assets/PlaceholderMesh.tsx'])

/** Code with comments blanked, so a path in a comment is not a literal. */
const code = (t: string): string => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('placeholder marks', () => {
  it('names a declared art file in every PLACEHOLDER comment', () => {
    const bad: string[] = []
    for (const f of files) {
      for (const m of f.text.matchAll(MARK)) if (!DECLARED.has(m[1])) bad.push(`${f.path}: ${m[1]}`)
    }
    expect(bad).toEqual([])
  })

  it('puts a PLACEHOLDER comment within 3 lines above every PlaceholderMesh use', () => {
    const bad: string[] = []
    for (const f of files) {
      if (DEFINES.has(f.path)) continue
      const lines = f.text.split(/\r?\n/)
      lines.forEach((line, i) => {
        if (!/<PlaceholderMesh\b/.test(line)) return
        const above = lines.slice(Math.max(0, i - 3), i + 1).join('\n')
        if (!/PLACEHOLDER: \/assets\//.test(above)) bad.push(`${f.path}:${i + 1}`)
      })
    }
    expect(bad).toEqual([])
  })

  it('writes no .glb path literal outside data/assets.ts (items.ts builds the item paths)', () => {
    const allowed = new Set(['src/data/assets.ts', 'src/data/items.ts'])
    const bad: string[] = []
    for (const f of files) {
      if (allowed.has(f.path)) continue
      code(f.text)
        .split(/\r?\n/)
        .forEach((line, i) => {
          if (/['"`][^'"`]*\.glb['"`]/.test(line)) bad.push(`${f.path}:${i + 1}`)
        })
    }
    expect(bad).toEqual([])
  })
})
