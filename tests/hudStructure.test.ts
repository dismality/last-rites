/// <reference types="vite/client" />
// Structure checks for spec 06 (Req 2.8, 2.9, 10.5, 11.1, 11.2, 11.3).
import { describe, expect, it } from 'vitest'
import { ZONE_CARDS, ZONE_CARD_COOLDOWN_S, ZONE_CARD_SHOW_S } from '../src/data/zoneCards'

// Sources are bundled as text by Vite, so the test needs no Node typings.
const gameSources = import.meta.glob<string>('../src/game/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
})
const hudCss = import.meta.glob<string>('../src/ui/hud/*.css', {
  query: '?raw',
  import: 'default',
  eager: true,
})
const hudTsx = import.meta.glob<string>('../src/ui/hud/*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
})
describe('spec 06 structure', () => {
  it('keeps react, three and howler out of src/game', () => {
    const banned =
      /from\s+['"](react|react-dom|three|howler)(\/[^'"]*)?['"]|from\s+['"]@react-three\//
    const offenders = Object.entries(gameSources)
      .filter(([, text]) => banned.test(text))
      .map(([file]) => file)
    expect(offenders).toEqual([])
  })

  it('uses no font-size under 1rem in the HUD CSS', () => {
    const small: string[] = []
    for (const [file, text] of Object.entries(hudCss)) {
      for (const m of text.matchAll(/font-size:\s*([\d.]+)(px|rem|em)\b/g)) {
        const px = m[2] === 'px' ? Number(m[1]) : Number(m[1]) * 16
        if (px < 16) small.push(`${file}: ${m[0]}`)
      }
    }
    expect(small).toEqual([])
  })

  it('does not hard-code §11 strings or timings in the new HUD components', () => {
    const components = ['HealthBar', 'LanternGauge', 'ObjectiveTracker', 'Compass', 'ZoneCard'].map(
      (n) => `../src/ui/hud/${n}.tsx`,
    )
    const strings = [
      ...Object.values(ZONE_CARDS).flatMap((c) => [c.name, c.line]),
      'Low oil',
      'Survive: Wave',
      'Hold out until the fifth night',
      'Prepare for the night',
      'Night falls in',
    ]
    const timing = new RegExp(`\\b(${ZONE_CARD_SHOW_S * 1000}|${ZONE_CARD_COOLDOWN_S * 1000})\\b`)
    for (const file of components) {
      const text = hudTsx[file]
      for (const s of strings) expect(text, `${file} contains "${s}"`).not.toContain(s)
      expect(text, `${file} hard-codes a card timing`).not.toMatch(timing)
    }
  })

  it('no longer ships the old flame-health and fuel-tube components', () => {
    const names = Object.keys(hudTsx).map((f) => f.split(/[\\/]/).pop())
    expect(names).not.toContain('LanternHealth.tsx')
    expect(names).not.toContain('FuelReservoir.tsx')
  })
})
