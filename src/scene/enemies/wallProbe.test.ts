import RAPIER from '@dimforge/rapier3d-compat'
import { beforeAll, describe, expect, it } from 'vitest'
import { SCARE_ZONES } from '../../data/scares'
import { WAVE_GRAVES } from '../../data/waves'
import { makeWallProbe } from './wallProbe'

beforeAll(async () => {
  await RAPIER.init()
})

function worldWith(build: (w: RAPIER.World) => void): RAPIER.World {
  const w = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
  build(w)
  w.step() // the query pipeline only sees colliders after a step
  return w
}

describe('enemy wall probe', () => {
  it('ignores a sensor the zombie is standing in', () => {
    const w = worldWith((w) => {
      w.createCollider(RAPIER.ColliderDesc.cuboid(5, 2, 5).setTranslation(0, 2, 0).setSensor(true))
    })
    const blocked = makeWallProbe(w, RAPIER)
    for (const [x, z] of [
      [3, 0],
      [-3, 0],
      [0, 3],
      [0, -3],
    ]) {
      expect(blocked({ x: 0, z: 0 }, { x, z })).toBe(false)
    }
  })

  it('still sees a real wall', () => {
    const w = worldWith((w) => {
      w.createCollider(RAPIER.ColliderDesc.cuboid(0.2, 1, 3).setTranslation(2, 1, 0))
    })
    const blocked = makeWallProbe(w, RAPIER)
    expect(blocked({ x: 0, z: 0 }, { x: 4, z: 0 })).toBe(true)
    expect(blocked({ x: 0, z: 0 }, { x: -4, z: 0 })).toBe(false)
  })

  it('a wave grave inside a scare zone is not boxed in', () => {
    const zone = SCARE_ZONES.find((z) => z.id === 'grounds-west-hill')!
    const grave = WAVE_GRAVES.find((g) => g.id === 'wg-west')!
    const [x0, y0, z0] = zone.bounds.min
    const [x1, y1, z1] = zone.bounds.max
    // The layout this guards: the grave really is inside the sensor.
    expect(grave.x > x0 && grave.x < x1 && grave.z > z0 && grave.z < z1).toBe(true)
    const w = worldWith((w) => {
      w.createCollider(
        RAPIER.ColliderDesc.cuboid((x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2)
          .setTranslation((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
          .setSensor(true),
      )
    })
    const blocked = makeWallProbe(w, RAPIER)
    expect(blocked({ x: grave.x, z: grave.z }, { x: grave.x + 1.5, z: grave.z })).toBe(false)
  })
})
