/// <reference types="vite/client" />
// Structure checks for spec 07 HUD (Req 7.1, 17.4, 21.5).
import { describe, expect, it } from 'vitest'

const hudCss = import.meta.glob<string>('../src/ui/hud/*.css', {
  query: '?raw',
  import: 'default',
  eager: true,
})
const hudSource = import.meta.glob<string>('../src/ui/hud/Hud.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
})

const NEW_CSS = [
  'AmmoReadout',
  'EffectIcons',
  'HitMarker',
  'ChargeMeter',
  'DoorStatus',
  'BossBar',
  'BossNameCard',
]

describe('spec 07 HUD structure', () => {
  it('uses no font-size under 1rem in the new HUD CSS', () => {
    const small: string[] = []
    for (const name of NEW_CSS) {
      const text = hudCss[`../src/ui/hud/${name}.css`]
      expect(text, `${name}.css is bundled`).toBeDefined()
      for (const m of text.matchAll(/font-size:\s*([\d.]+)(px|rem|em)\b/g)) {
        const px = m[2] === 'px' ? Number(m[1]) : Number(m[1]) * 16
        if (px < 16) small.push(`${name}.css: ${m[0]}`)
      }
    }
    expect(small).toEqual([])
  })

  it('mounts the new components in Hud.tsx', () => {
    const text = Object.values(hudSource)[0]
    for (const c of ['AmmoReadout', 'EffectIcons', 'ChargeMeter', 'DoorStatus', 'BossBar', 'BossNameCard']) {
      expect(text).toContain(`<${c} />`)
    }
    expect(text).toContain('hud-top-stack')
  })
})
