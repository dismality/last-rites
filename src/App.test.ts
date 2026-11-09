import { describe, expect, it } from 'vitest'
// No DOM env for the Canvas, so check the scene tree structurally from source.
import src from './App.tsx?raw'

const at = (tag: string): number => src.indexOf(`<${tag} />`)

describe('App scene tree', () => {
  it('mounts the progression and atmosphere components', () => {
    for (const tag of ['Merchant', 'CoinPiles', 'Weather', 'MusicDriver']) {
      expect(at(tag), tag).toBeGreaterThan(-1)
    }
  })

  it('orders Weather after SkyAndFog and the rest after EnemyDirector', () => {
    expect(at('Weather')).toBeGreaterThan(at('SkyAndFog'))
    for (const tag of ['MusicDriver', 'Merchant', 'CoinPiles']) {
      expect(at(tag), tag).toBeGreaterThan(at('EnemyDirector'))
    }
  })
})
