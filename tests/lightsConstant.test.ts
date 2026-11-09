import { describe, expect, it } from 'vitest'
// Changing the number of lights in the main scene recompiles every lit material (the 0.7 s
// first-workbench freeze). So no light may be mounted conditionally or inside a .map().

/** Separate <Canvas>/portal scenes with their own renderer or lights; they cannot recompile the main scene. */
const ALLOW_LIST = ['examine/ExamineScene.tsx', 'player/Viewmodel.tsx']

const LIGHT = String.raw`<(?:point|spot|directional|rectArea|hemisphere|ambient)Light\b`

describe('light count is constant in the main scene', () => {
  const raw = import.meta.glob('../src/scene/**/*.tsx', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>
  const files = Object.entries(raw)
    .map(([path, src]) => ({ rel: path.replace('../src/scene/', ''), src }))
    .filter((f) => !f.rel.endsWith('.test.tsx') && !ALLOW_LIST.includes(f.rel))

  it('finds the scene files', () => {
    expect(files.length).toBeGreaterThan(10)
  })

  it('has no `cond && <light` or ternary light mounting', () => {
    for (const f of files) {
      expect(f.src, f.rel).not.toMatch(new RegExp(String.raw`&&\s*\(?\s*${LIGHT}`))
      expect(f.src, f.rel).not.toMatch(new RegExp(String.raw`\?\s*\(?\s*${LIGHT}`))
      expect(f.src, f.rel).not.toMatch(new RegExp(String.raw`\)\s*:\s*\(?\s*${LIGHT}`))
    }
  })

  it('has no early `return null` before a light in the same component file', () => {
    for (const f of files) {
      if (!new RegExp(LIGHT).test(f.src)) continue
      expect(f.src, f.rel).not.toMatch(
        /if \([^)]*\) return null\s*\n\s*return \(\s*\n\s*<(point|spot)Light/,
      )
    }
  })

  it('has no light mounted inside a .map() callback except the fixed pools', () => {
    const POOLS = ['world/LanternTraps.tsx'] // POOL_INDEXES is a constant-length array
    for (const f of files) {
      if (POOLS.includes(f.rel)) continue
      expect(f.src, f.rel).not.toMatch(new RegExp(String.raw`\.map\([^]*?=>\s*\(?\s*${LIGHT}`))
    }
  })
})
