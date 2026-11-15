/// <reference types="vite/client" />
// The boss name card must not cover the boss bar at common heights (spec 08 task 10.9).
import { describe, expect, it } from 'vitest'

const css = import.meta.glob<string>('../src/ui/hud/*.css', {
  query: '?raw',
  import: 'default',
  eager: true,
})
const get = (name: string): string =>
  css[Object.keys(css).find((k) => k.endsWith('/' + name)) ?? ''] ?? ''

/** Top of the HUD top stack in rem: 0.75 + compass 5 + 0.5, plus any offset in hud.css. */
export function stackTopRem(hud: string): number {
  const below = 0.75 + 5 + 0.5
  const m = hud.match(/\.hud-top-stack\s*\{[^}]*top:\s*(?:calc\(var\(--hud-below-compass\)\s*\+\s*([\d.]+)rem\)|var\(--hud-below-compass\))/)
  if (!m) return NaN
  return below + Number(m[1] ?? 0)
}

/** Vertical band [top, bottom] in px of the card's own rule (percent top) at a viewport height. */
export function cardBand(cardCss: string, viewportH: number, heightRem: number): [number, number] {
  const m = cardCss.match(/\.boss-name-card\s*\{[^}]*top:\s*([\d.]+)%/)
  const top = (Number(m?.[1] ?? NaN) / 100) * viewportH
  return [top, top + heightRem * 16]
}

describe('boss name card placement', () => {
  // The stack holds the wave tally (about 4rem), rite meter (about 7rem), boss bar (about 7rem)
  // and door status (about 3rem), with three 0.5rem gaps (spec 09 task 18).
  const STACK_REM = 22.5
  it.each([1080, 720])('does not intersect the boss bar band at %ipx tall', (h) => {
    const barTop = stackTopRem(get('hud.css')) * 16
    expect(Number.isFinite(barTop)).toBe(true)
    const bar: [number, number] = [barTop, barTop + STACK_REM * 16]
    const card = cardBand(get('BossNameCard.css'), h, 6)
    expect(Number.isFinite(card[0])).toBe(true)
    expect(card[0]).toBeGreaterThanOrEqual(bar[1])
    expect(card[1]).toBeLessThanOrEqual(h)
  })

  it('keeps readable text and the reduced-motion override', () => {
    const text = get('BossNameCard.css')
    for (const m of text.matchAll(/font-size:\s*([\d.]+)rem/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(1)
    expect(text).toMatch(/background:\s*rgb\(20 17 15/)
    expect(text).toMatch(/prefers-reduced-motion[\s\S]*animation:\s*none/)
  })
})
