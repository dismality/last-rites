import { describe, expect, it } from 'vitest'
import * as fc from 'fast-check'
import { ENEMY_MAP, type EnemyId } from '../../data/enemies'
import { GRAVITY, TRAP_TRIGGER_RADIUS_M } from '../../data/projectiles'
import {
  arcPoints,
  constrainToSalt,
  createFuse,
  createSaltCircle,
  createTrap,
  keepOutOfSalt,
  resolveFlask,
  resolveNailBomb,
  throwVelocity,
  tickFuse,
  tickSaltCircles,
  tickTrap,
} from './projectiles'
import type { StaggerEnemy } from './melee'

const zombie = (uid: string, x: number, z: number, type: EnemyId = 'shambler'): StaggerEnemy => ({
  uid,
  type,
  hp: ENEMY_MAP[type].hp,
  pos: { x, z },
  stagger: 0,
})

describe('arcPoints', () => {
  it('lands on the ground and reports the landing point', () => {
    const arc = arcPoints({ x: 0, y: 1.6, z: 0 }, { x: 0, y: 3, z: -8 })
    expect(arc.landing).not.toBeNull()
    expect(arc.landing?.y).toBe(0)
    expect(arc.points[arc.points.length - 1]).toEqual(arc.landing)
    expect(arc.landing!.z).toBeLessThan(-7)
  })

  it('has no landing when the step budget runs out first', () => {
    expect(arcPoints({ x: 0, y: 1, z: 0 }, { x: 0, y: 20, z: 0 }, GRAVITY, 3).landing).toBeNull()
  })

  it('throws along the look direction (yaw 0 faces -Z)', () => {
    const v = throwVelocity(0, 0, 10)
    expect(v.z).toBeLessThan(0)
    expect(v.x).toBeCloseTo(0)
    expect(Math.hypot(v.x, v.y, v.z)).toBeCloseTo(10)
  })

  it('property: no sampled point is below ground and every landing is on it', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -3, max: 3, noNaN: true }),
        fc.double({ min: -1.2, max: 1.2, noNaN: true }),
        (yaw, pitch) => {
          const arc = arcPoints({ x: 0, y: 1.6, z: 0 }, throwVelocity(yaw, pitch, 11))
          expect(arc.points.every((p) => p.y >= 0)).toBe(true)
          if (arc.landing) expect(arc.landing.y).toBe(0)
        },
      ),
    )
  })
})

describe('fuse', () => {
  it('fires once, on the tick the 2 s fuse expires', () => {
    let f = createFuse(2)
    let fires = 0
    for (let i = 0; i < 200; i++) {
      const r = tickFuse(f, 1 / 60)
      f = r.fuse
      if (r.fire) fires++
    }
    expect(fires).toBe(1)
    expect(tickFuse(createFuse(2), 1.9).fire).toBe(false)
    expect(tickFuse(createFuse(2), 2).fire).toBe(true)
  })
})

describe('blasts', () => {
  it('flask: 40 damage within 2 m, stuns 2 s, spares those outside', () => {
    const r = resolveFlask({ x: 0, z: 0 }, [zombie('in', 1.5, 0), zombie('out', 2.5, 0)], 100, 2)
    expect(r.hitUids).toEqual(['in'])
    expect(r.enemies[0].hp).toBe(20)
    expect(r.enemies[0].stagger).toBe(2)
    expect(r.enemies[1].hp).toBe(60)
  })

  it('flask radiusBonusM widens the splash by that much', () => {
    const es = [zombie('edge', 2.5, 0)]
    expect(resolveFlask({ x: 0, z: 0 }, es, 100, 2).hitUids).toEqual([])
    expect(resolveFlask({ x: 0, z: 0 }, es, 100, 2, 1).hitUids).toEqual(['edge'])
  })

  it('flask deals double damage to wailers', () => {
    const r = resolveFlask({ x: 0, z: 0 }, [zombie('w', 1, 0, 'wailer')], 100, 2)
    expect(r.enemies[0].hp).toBe(0)
    expect(r.killedUids).toEqual(['w'])
  })

  it('nail bomb: 80 damage within 3 m', () => {
    const r = resolveNailBomb({ x: 0, z: 0 }, [zombie('a', 2.9, 0), zombie('b', 3.1, 0)], 100)
    expect(r.hitUids).toEqual(['a'])
    expect(r.enemies[0].hp).toBe(0)
  })
})

describe('lantern trap', () => {
  it('stays armed until a zombie is within 1.5 m', () => {
    const far = [zombie('z', TRAP_TRIGGER_RADIUS_M + 0.5, 0)]
    const r = tickTrap(createTrap('t', { x: 0, z: 0 }), 1, far, 100)
    expect(r.trap.state).toBe('armed')
    expect(r.enemies[0].hp).toBe(60)
  })

  it('burns 10/s for 5 s then is spent', () => {
    let trap = createTrap('t', { x: 0, z: 0 })
    let enemies: StaggerEnemy[] = [{ ...zombie('z', 1, 0), hp: 1000 }]
    let sprang = 0
    for (let i = 0; i < 60 * 8; i++) {
      const r = tickTrap(trap, 1 / 60, enemies, 100)
      trap = r.trap
      enemies = r.enemies
      if (r.sprung) sprang++
    }
    expect(sprang).toBe(1)
    expect(trap.state).toBe('spent')
    expect(enemies[0].hp).toBeCloseTo(950, 5)
  })

  it('also burns zombies 2 m away that did not trigger it', () => {
    const r = tickTrap(createTrap('t', { x: 0, z: 0 }), 1, [zombie('near', 1, 0), zombie('edge', -1.9, 0)], 100)
    expect(r.enemies[1].hp).toBe(50)
  })
})

describe('salt circle', () => {
  const circle = createSaltCircle('s', { x: 0, z: 0 })

  it('lasts 30 s', () => {
    expect(tickSaltCircles([circle], 29.9)).toHaveLength(1)
    expect(tickSaltCircles([circle], 30)).toHaveLength(0)
  })

  it('pushes a point inside the 2 m radius out to the rim', () => {
    const p = keepOutOfSalt({ x: 1, z: 0 }, [circle])
    expect(p.x).toBeCloseTo(2)
    expect(keepOutOfSalt({ x: 0, z: 0 }, [circle])).toEqual({ x: 2, z: 0 })
  })

  it('leaves outside zombies untouched and keeps array identity when nothing moves', () => {
    const list = [zombie('a', 5, 5)]
    expect(constrainToSalt(list, [circle])).toBe(list)
  })

  it('property: no constrained zombie ends inside the circle', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -4, max: 4, noNaN: true }),
        fc.double({ min: -4, max: 4, noNaN: true }),
        (x, z) => {
          const [e] = constrainToSalt([zombie('p', x, z)], [circle])
          expect(Math.hypot(e.pos.x, e.pos.z)).toBeGreaterThanOrEqual(2 - 1e-9)
        },
      ),
    )
  })
})
