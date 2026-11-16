import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { CATACOMB_BOXES } from '../../data/catacombsScenery'
import { CATACOMBS, CHAPEL, CHAPEL_CENTER } from '../../data/cemeteryLayout'
import {
  ALTAR_SLIDE,
  CHAPEL_STAIR,
  STAIR_DESCENT,
  STAIR_DESCENT_TIMING,
  type ChapelBox,
} from '../../data/chapelScenery'
import { chapelSceneColliders } from './chapelColliders'
import { altarSlideOffset, stairColliders, stairOpeningWorld, stairSurfaceY } from './chapelStair'
import {
  DESCENT_ARRIVAL,
  PLAYER_RADIUS,
  altarAt,
  altarPushOut,
  circleHitsBox,
  descentFrame,
  descentTriggerWorld,
  inCatacombCorridor,
  inDescentTrigger,
  nearestFreePoint,
  redirectViaStair,
  sanitizeStairPosition,
  STAIR_GUIDE_POINT,
  distanceToBox,
} from './stairDescent'

const box = (x: number, z: number, hx: number, hz: number): ChapelBox => ({
  center: [x, 0.5, z],
  half: [hx, 0.5, hz],
  rotY: 0,
  note: 'test',
})

describe('the descent trigger', () => {
  it('sits inside the stair opening and its top is below y -0.5', () => {
    const t = descentTriggerWorld()
    const o = stairOpeningWorld(CHAPEL_CENTER)
    expect(STAIR_DESCENT.yMax).toBeLessThan(-0.5 + 1e-9)
    expect(t.max[1]).toBeLessThan(-0.5 + 1e-9)
    expect(t.min[0]).toBeGreaterThanOrEqual(o.xMin - 1e-9)
    expect(t.max[0]).toBeLessThanOrEqual(o.xMax + 1e-9)
    expect(t.min[2]).toBeGreaterThanOrEqual(o.zMin - 1e-9)
    expect(t.max[2]).toBeLessThanOrEqual(o.zMax + 1e-9)
  })

  it('starts where the steps pass y -0.5, about three steps down', () => {
    expect(stairSurfaceY(STAIR_DESCENT.z0)).toBeCloseTo(-0.5, 9)
    expect((STAIR_DESCENT.z0 - CHAPEL_STAIR.z0) / CHAPEL_STAIR.run).toBeGreaterThan(2.5)
  })

  it('is reached before the end wall: the capsule against the wall stands inside it, at any hanging height', () => {
    const [cx, , cz] = CHAPEL_CENTER
    // The end wall stops the capsule centre one radius short of the wall face (browser: z 5.47..5.49).
    const atWall = CHAPEL_STAIR.innerBackZ - PLAYER_RADIUS - 0.02
    expect(atWall).toBeGreaterThan(STAIR_DESCENT.z0)
    for (const y of [-0.26, -0.29, -0.43, -0.53]) expect(inDescentTrigger([cx, y, cz + atWall])).toBe(true)
  })

  it('does not fire on the floor, at the top of the steps or beside the opening', () => {
    const [cx, , cz] = CHAPEL_CENTER
    expect(inDescentTrigger([cx, 0.05, cz + 5.5])).toBe(false) // standing level (noclip, a stale floor)
    expect(inDescentTrigger([cx, stairSurfaceY(4.9), cz + 4.9])).toBe(false)
    expect(inDescentTrigger([cx, stairSurfaceY(5.3), cz + 5.3])).toBe(false)
    expect(inDescentTrigger([cx + 1.5, -0.8, cz + 5.5])).toBe(false)
  })
})

describe('the fade timeline', () => {
  it('fades out in 0.6 s, holds black with input locked, moves the player, then fades in over 0.8 s', () => {
    expect(descentFrame(0)).toMatchObject({ opacity: 0, black: false, moved: false })
    expect(descentFrame(STAIR_DESCENT_TIMING.fadeOut / 2).opacity).toBeCloseTo(0.5, 9)
    const hold = descentFrame(STAIR_DESCENT_TIMING.fadeOut + 0.1)
    expect(hold).toMatchObject({ opacity: 1, black: true, moved: true, done: false })
    const midIn = descentFrame(STAIR_DESCENT_TIMING.fadeOut + STAIR_DESCENT_TIMING.black + STAIR_DESCENT_TIMING.fadeIn / 2)
    expect(midIn.opacity).toBeCloseTo(0.5, 9)
    expect(midIn.black).toBe(false)
    expect(descentFrame(10)).toMatchObject({ opacity: 0, done: true })
  })

  it('locks input only while black, and opacity stays in 0..1', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 5, noNaN: true }), (t) => {
        const f = descentFrame(t)
        expect(f.opacity).toBeGreaterThanOrEqual(0)
        expect(f.opacity).toBeLessThanOrEqual(1)
        expect(f.black).toBe(f.opacity === 1 && !f.done)
      }),
    )
  })
})

describe('arrival in the catacomb corridor', () => {
  const [ax, , az] = DESCENT_ARRIVAL.position
  it('is inside the corridor, past the gate wall, facing down it (+z)', () => {
    expect(inCatacombCorridor(ax, az)).toBe(true)
    expect(az).toBeGreaterThan(CATACOMBS.entranceZ + CATACOMBS.wallThickness + PLAYER_RADIUS)
    expect(Math.abs(DESCENT_ARRIVAL.yaw - Math.PI)).toBeLessThan(1e-9)
  })

  it('clears the corridor walls and every catacomb collider by a full capsule', () => {
    expect(Math.abs(ax - CATACOMBS.centerX)).toBeLessThan(CATACOMBS.width / 2 - PLAYER_RADIUS)
    for (const b of CATACOMB_BOXES) {
      const asBox: ChapelBox = { center: b.center, half: b.half, rotY: b.rotY, note: b.note }
      expect(distanceToBox(ax, az, asBox), b.note).toBeGreaterThanOrEqual(PLAYER_RADIUS)
    }
  })
})

describe('a position inside the stair shaft', () => {
  const [cx, , cz] = CHAPEL_CENTER
  it('becomes the corridor arrival, for any depth and any spot in the opening', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -0.6, max: 0.6, noNaN: true }),
        fc.double({ min: 4.8, max: 5.8, noNaN: true }),
        fc.double({ min: -2.5, max: -0.3, noNaN: true }),
        (dx, dz, y) => {
          const r = sanitizeStairPosition([cx + dx, y, cz + dz], 1.2)
          expect(r.moved).toBe(true)
          expect(r.position).toEqual([...DESCENT_ARRIVAL.position])
        },
      ),
    )
  })

  it('leaves everything else alone, including the top of the steps and the open ground', () => {
    expect(sanitizeStairPosition([cx, 0.05, cz + 3], 0.4).moved).toBe(false)
    expect(sanitizeStairPosition([cx, -0.1, cz + 4.9], 0.4).moved).toBe(false)
    expect(sanitizeStairPosition([25, 0.05, 45], 0).position).toEqual([25, 0.05, 45])
  })
})

describe('the altar never lands on the player', () => {
  const rest = chapelSceneColliders(0).find((b) => b.note === 'altar')!

  it('shoves a player standing at the altar ahead of it for the whole slide', () => {
    // The player stands where the whistle is used: against the altar's front face (rest 4.5).
    let z = rest.center[2] - rest.half[2] - PLAYER_RADIUS
    for (let t = 0; t <= ALTAR_SLIDE.seconds + 0.5; t += 1 / 60) {
      const altar = altarAt(rest, altarSlideOffset(t))
      z += altarPushOut(0, z, altar)
      expect(circleHitsBox(0, z, altar)).toBe(false)
    }
    // Ends 0.6 m nearer the door, still short of the back pew's end (z 2.69) plus the capsule.
    // (the push leaves the controller's 3 cm skin allowance, so it ends within that of touching)
    const touching = rest.center[2] - rest.half[2] - PLAYER_RADIUS - ALTAR_SLIDE.distance
    expect(z).toBeGreaterThanOrEqual(touching - 1e-9)
    expect(z).toBeLessThan(touching + 0.03)
    expect(z).toBeGreaterThan(2.69 + PLAYER_RADIUS)
  })

  it('never pushes a player who is clear of it, and the push always ends clear', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -2.3, max: 2.3, noNaN: true }),
        fc.double({ min: 3, max: 5.5, noNaN: true }),
        fc.double({ min: -0.6, max: 0, noNaN: true }),
        (x, z, off) => {
          const altar = altarAt(rest, off)
          const dz = altarPushOut(x, z, altar)
          if (!circleHitsBox(x, z, altar, PLAYER_RADIUS - 0.03)) expect(dz).toBe(0)
          else expect(circleHitsBox(x, z + dz, altar, PLAYER_RADIUS - 0.03)).toBe(false)
        },
      ),
    )
  })

  it('the safety net finds a free spot in the nave for a player stuck inside the altar', () => {
    const slid = chapelSceneColliders(-ALTAR_SLIDE.distance)
    const spot = nearestFreePoint(0, 4.3, slid)!
    expect(spot).not.toBeNull()
    for (const b of slid) expect(distanceToBox(spot.x, spot.z, b)).toBeGreaterThanOrEqual(PLAYER_RADIUS)
    expect(Math.hypot(spot.x, spot.z - 4.3)).toBeLessThan(1.2)
  })
})

describe('the walkway round the slid altar', () => {
  const slid = chapelSceneColliders(-ALTAR_SLIDE.distance)
  const innerX = CHAPEL.halfX - CHAPEL.wallThickness / 2
  const backZ = CHAPEL_STAIR.innerBackZ
  const STEP = 0.05

  /** Breadth-first search for a circle of `r` from the nave to the top of the stair opening. */
  function reachable(boxes: readonly ChapelBox[], r: number): boolean {
    const key = (i: number, j: number) => i * 1000 + j
    const x0 = -innerX + r
    const nx = Math.floor((2 * (innerX - r)) / STEP)
    const z0 = -4
    const nz = Math.floor((backZ - r - z0) / STEP)
    const free = (i: number, j: number) => {
      if (i < 0 || j < 0 || i > nx || j > nz) return false
      const x = x0 + i * STEP
      const z = z0 + j * STEP
      return !boxes.some((b) => distanceToBox(x, z, b) < r - 1e-9)
    }
    const si = Math.round((0 - x0) / STEP)
    const sj = 0
    // Goal: standing in the opening just behind the altar, where the ramp begins.
    const gi = Math.round((0 - x0) / STEP)
    const gj = Math.round((CHAPEL_STAIR.z0 + 0.5 - z0) / STEP)
    if (!free(si, sj) || !free(gi, gj)) return false
    const seen = new Set([key(si, sj)])
    const queue: [number, number][] = [[si, sj]]
    while (queue.length) {
      const [i, j] = queue.shift()!
      if (i === gi && j === gj) return true
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di
        const nj = j + dj
        if (seen.has(key(ni, nj)) || !free(ni, nj)) continue
        seen.add(key(ni, nj))
        queue.push([ni, nj])
      }
    }
    return false
  }

  // A block that closes one side of the altar, so the other side alone has to carry the route.
  const eastBlock = box(1.7, 3.9, 0.8, 0.9)
  const westBlock = box(-1.7, 3.9, 0.8, 0.9)

  it.each([PLAYER_RADIUS, 0.4])('a %s m capsule reaches the stair round either side with every collider counted', (r) => {
    expect(reachable(slid, r)).toBe(true)
    expect(reachable([...slid, eastBlock], r)).toBe(true) // west side alone
    expect(reachable([...slid, westBlock], r)).toBe(true) // east side alone
    expect(reachable([...slid, eastBlock, westBlock], r)).toBe(false) // the test can fail
  })

  it('the altar slid, the back pews and the opening leave 0.8 m or more of walkway', () => {
    const altar = slid.find((b) => b.note === 'altar')!
    const backPewEnd = Math.max(...slid.filter((b) => b.note === 'pew').map((b) => b.center[2] + b.half[2]))
    expect(altar.center[2] - altar.half[2] - backPewEnd).toBeGreaterThanOrEqual(0.8)
    expect(altar.center[2] + altar.half[2]).toBeLessThanOrEqual(CHAPEL_STAIR.z0)
  })

  it('the shaft walls stay below the floor so the opening is entered from the sides', () => {
    for (const w of stairColliders().walls) expect(w.center[1] + w.half[1]).toBeCloseTo(0, 9)
  })
})

describe('guidance', () => {
  const inside: [number, number, number] = [25, 0.78, 53]
  const grounds: [number, number, number] = [0, 0, 0]
  it('points a player outside the catacombs at the chapel stair once it is open', () => {
    expect(redirectViaStair(inside, grounds, true)).toEqual(STAIR_GUIDE_POINT)
  })
  it('leaves targets alone when the stair is sealed, the target is elsewhere, or the player is already down', () => {
    expect(redirectViaStair(inside, grounds, false)).toEqual(inside)
    expect(redirectViaStair([-20, 0, -50], grounds, true)).toEqual([-20, 0, -50])
    expect(redirectViaStair(inside, [25, 0.05, 45], true)).toEqual(inside)
    expect(redirectViaStair(undefined, grounds, true)).toBeUndefined()
  })
})
