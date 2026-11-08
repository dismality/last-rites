import { describe, expect, it } from 'vitest'
import { SPAWN_JITTER_M, WAVE_GRAVES } from '../../data/waves'
import { createRng } from '../rng'
import { startNight, tickWaves } from './waves'

const tick = (seed: number) =>
  tickWaves(startNight(1), 0.1, { playerPos: { x: 0, z: 0 }, liveCount: 0, rng: createRng(seed) })

describe('wave spawn spread', () => {
  it('never puts two zombies of one burst on the same point', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const { spawns } = tick(seed)
      expect(spawns).toHaveLength(4)
      const keys = new Set(spawns.map((s) => `${s.x.toFixed(3)},${s.z.toFixed(3)}`))
      expect(keys.size).toBe(spawns.length)
    }
  })

  it('uses different graves for a burst when enough are eligible', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const ids = tick(seed).spawns.map((s) => s.graveId)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('keeps every spawn within the jitter radius of its grave', () => {
    for (const s of tick(7).spawns) {
      const g = WAVE_GRAVES.find((w) => w.id === s.graveId)!
      expect(Math.abs(s.x - g.x)).toBeLessThanOrEqual(SPAWN_JITTER_M)
      expect(Math.abs(s.z - g.z)).toBeLessThanOrEqual(SPAWN_JITTER_M)
    }
  })
})
