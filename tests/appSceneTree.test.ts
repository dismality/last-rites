/// <reference types="vite/client" />
// Source-structure check: App mounts the spec 07 scene components in the right order (Req 23.10).
import { describe, expect, it } from 'vitest'

const sources = import.meta.glob<string>('../src/App.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
})
const app = Object.values(sources)[0] ?? ''
const at = (name: string) => app.indexOf(`<${name} />`)

describe('App scene tree (spec 07)', () => {
  it.each([
    'WeaponController',
    'UseController',
    'ChapelDoors',
    'WeaponPickups',
    'DamageNumbers',
    'GraveGas',
    'MuzzleLight',
  ])('mounts %s', (name) => {
    expect(at(name)).toBeGreaterThan(-1)
  })

  it('mounts controllers inside GameLoop and after EnemyDirector and SaltCircles ordering holds', () => {
    const open = app.indexOf('<GameLoop>')
    const close = app.indexOf('</GameLoop>')
    for (const n of ['WeaponController', 'UseController', 'ChapelDoors', 'WeaponPickups']) {
      expect(at(n)).toBeGreaterThan(open)
      expect(at(n)).toBeLessThan(close)
    }
    expect(at('WeaponController')).toBeGreaterThan(at('EnemyDirector'))
    expect(at('UseController')).toBeGreaterThan(at('EnemyDirector'))
    expect(at('DamageNumbers')).toBeGreaterThan(at('SaltCircles'))
    expect(at('GraveGas')).toBeGreaterThan(at('EnemyDirector'))
    expect(at('MuzzleLight')).toBeGreaterThan(at('EnemyDirector'))
  })
})
