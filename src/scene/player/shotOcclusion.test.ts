import RAPIER from '@dimforge/rapier3d-compat'
import { beforeAll, describe, expect, it } from 'vitest'
import { makeWallDistance } from './shotOcclusion'

beforeAll(async () => {
  await RAPIER.init()
})

function worldWith(build: (w: RAPIER.World) => void): RAPIER.World {
  const w = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
  build(w)
  w.step() // the query pipeline only sees colliders after a step
  return w
}

const ORIGIN = { x: 0, y: 1.6, z: 0 }
const FORWARD = { x: 1, y: 0, z: 0 }

describe('shot occlusion', () => {
  it('stops at a real box', () => {
    const w = worldWith((w) => {
      w.createCollider(RAPIER.ColliderDesc.cuboid(0.5, 2, 3).setTranslation(5, 2, 0))
    })
    const d = makeWallDistance(w, RAPIER)(ORIGIN, FORWARD, 40)
    expect(d).toBeCloseTo(4.5, 3)
  })

  it('reports Infinity when nothing is in range', () => {
    const w = worldWith((w) => {
      w.createCollider(RAPIER.ColliderDesc.cuboid(0.5, 2, 3).setTranslation(50, 2, 0))
    })
    expect(makeWallDistance(w, RAPIER)(ORIGIN, FORWARD, 40)).toBe(Infinity)
  })

  it('ignores a sensor around the shooter', () => {
    const w = worldWith((w) => {
      w.createCollider(
        RAPIER.ColliderDesc.cuboid(10, 5, 10).setTranslation(0, 2, 0).setSensor(true),
      )
    })
    expect(makeWallDistance(w, RAPIER)(ORIGIN, FORWARD, 40)).toBe(Infinity)
  })

  it('ignores the kinematic player body', () => {
    const w = worldWith((w) => {
      const body = w.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 1, 0),
      )
      w.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.4), body)
      w.createCollider(RAPIER.ColliderDesc.cuboid(0.5, 2, 3).setTranslation(8, 2, 0))
    })
    const d = makeWallDistance(w, RAPIER)(ORIGIN, FORWARD, 40)
    expect(d).toBeCloseTo(7.5, 3)
  })

  it('returns Infinity when the query fails', () => {
    const w = worldWith(() => {})
    w.free()
    expect(makeWallDistance(w, RAPIER)(ORIGIN, FORWARD, 40)).toBe(Infinity)
  })
})
