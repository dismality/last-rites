// Spec 09, B3: the day-1 oil lies on the walk from the hut to the crypt key, somewhere the player
// can reach. Adding it must not move a single tree (trees avoid spawn points).
import { describe, expect, it } from 'vitest'
import { generateHeadstones, generateTrees, HUT } from './cemeteryLayout'
import { FIXED_SPAWNS, SPAWN_POINTS } from './zones'

const oil = SPAWN_POINTS.find((p) => p.id === 'grounds-path-oil')!
const key = FIXED_SPAWNS.find((f) => f.id === 'fx-crypt-key')!

describe('day-1 path oil', () => {
  it('sits within 2 m of the straight line from the hut to the crypt key', () => {
    const [kx, , kz] = key.position
    const [x, , z] = oil.position
    const t = Math.max(0, Math.min(1, (x * kx + z * kz) / (kx * kx + kz * kz)))
    expect(Math.hypot(x - t * kx, z - t * kz)).toBeLessThan(2)
  })

  it('is outside the hut and clear of every headstone', () => {
    const [x, , z] = oil.position
    expect(Math.abs(x) > HUT.halfX || Math.abs(z) > HUT.halfZ).toBe(true)
    for (const h of generateHeadstones()) {
      expect(Math.hypot(h.position[0] - x, h.position[2] - z)).toBeGreaterThan(1.2)
    }
  })

  it('leaves the tree layout exactly as it was', () => {
    const others = [...SPAWN_POINTS.filter((p) => p !== oil), ...FIXED_SPAWNS].map((p) => p.position)
    expect(generateTrees([...others, oil.position])).toEqual(generateTrees(others))
  })
})
