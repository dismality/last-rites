/// <reference types="vite/client" />
// Structure checks for spec 08 HUD CSS (Req 2.6, 12.5, 12.8).
import { describe, expect, it } from 'vitest'

const css = import.meta.glob<string>(
  ['../src/ui/hud/*.css', '../src/ui/merchant/*.css', '../src/ui/menus/*.css'],
  { query: '?raw', import: 'default', eager: true },
)
const get = (name: string): string =>
  css[Object.keys(css).find((k) => k.endsWith('/' + name)) ?? ''] ?? ''

/** px sizes are converted at 16 px per rem. */
function sizesRem(text: string): number[] {
  return [...text.matchAll(/font-size:\s*([\d.]+)(rem|px)/g)].map((m) =>
    m[2] === 'px' ? Number(m[1]) / 16 : Number(m[1]),
  )
}

describe('spec 08 HUD CSS font sizes', () => {
  it.each(['ScorePanel.css', 'AchievementToasts.css', 'DawnPicker.css', 'MerchantMenu.css'])(
    '%s has no font-size under 1rem',
    (name) => {
      const sizes = sizesRem(get(name))
      expect(sizes.length).toBeGreaterThan(0)
      for (const s of sizes) expect(s).toBeGreaterThanOrEqual(1)
    },
  )

  it('menus.css mode__ and achievements__ rules have no font-size under 1rem', () => {
    const blocks = get('menus.css').match(/[^{}]*\b(mode|achievements)__[^{}]*\{[^}]*\}/g) ?? []
    expect(blocks.length).toBeGreaterThan(0)
    expect(blocks.some((b) => b.includes('achievements__'))).toBe(true)
    for (const b of blocks) for (const s of sizesRem(b)) expect(s).toBeGreaterThanOrEqual(1)
  })
})

describe('spec 08 HUD assembly', () => {
  it('mounts the 08 components in Hud.tsx after the 06 and 07 elements', async () => {
    const src = (await import('../src/ui/hud/Hud.tsx?raw')).default as string
    const last07 = src.indexOf('<DuskHint />')
    expect(last07).toBeGreaterThan(0)
    for (const c of ['ScorePanel', 'AchievementToasts', 'DawnCard', 'MerchantMenu']) {
      expect(src.indexOf(`<${c} />`)).toBeGreaterThan(last07)
    }
  })
})
