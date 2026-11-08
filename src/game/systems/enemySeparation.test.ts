import { describe, expect, it } from 'vitest'
import { createEnemy, tickEnemies, uidAngle, type AIEnemy } from './enemyAI'

const ctx = { playerPos: { x: 0, z: 0 }, playerFacing: { x: 0, z: 1 }, lanternFuel: 100 }
const gap = (a: AIEnemy, b: AIEnemy) => Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z)

describe('separation of stacked zombies', () => {
  it('splits two zombies that start on exactly the same point', () => {
    let zs: AIEnemy[] = ['a', 'b'].map((id) => ({
      ...createEnemy(id, 'shambler', { x: 0, z: 10 }),
      state: 'chase' as const,
    }))
    for (let i = 0; i < 40; i++) zs = tickEnemies(zs, 0.1, ctx).enemies
    expect(gap(zs[0], zs[1])).toBeGreaterThan(0.3)
  })

  it('gives different ids different push directions, and the same id the same one', () => {
    expect(uidAngle('z-1')).not.toBeCloseTo(uidAngle('z-2'), 3)
    expect(uidAngle('z-1')).toBe(uidAngle('z-1'))
  })
})
