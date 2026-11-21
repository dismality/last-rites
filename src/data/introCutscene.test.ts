import { describe, expect, it } from 'vitest'
import { INTRO_END_POSE, INTRO_FADE_S, INTRO_SHOTS } from './introCutscene'
import { samplePath } from '../game/systems/cameraPath'
import { HUT, generateTrees } from './cemeteryLayout'
import { SPAWN_YAW } from './spawn'
import { FIXED_SPAWNS } from './zones'
import { resetRun } from '../game/state/resetRun'
import { usePlayerStore } from '../game/state/playerStore'

describe('introCutscene data', () => {
  it('has 5 shots in order totalling about 20 s (spec 09, B15)', () => {
    expect(INTRO_SHOTS.map((s) => s.id)).toEqual([1, 2, 3, 4, 5])
    const total = INTRO_SHOTS.reduce((t, s) => t + s.duration, 0)
    expect(total).toBeGreaterThanOrEqual(18)
    expect(total).toBeLessThanOrEqual(22)
  })

  it('gives every shot >= 4 s, a card held >= 3 s inside the shot, and matched control points', () => {
    for (const s of INTRO_SHOTS) {
      expect(s.duration).toBeGreaterThanOrEqual(4)
      expect(s.card.hold).toBeGreaterThanOrEqual(3)
      expect(s.card.at + s.card.hold).toBeLessThanOrEqual(s.duration)
      expect(s.camera.position.length).toBeGreaterThanOrEqual(4)
      expect(s.camera.target.length).toBe(s.camera.position.length)
    }
  })

  it('uses the exact section 11 card texts', () => {
    expect(INTRO_SHOTS.map((s) => s.card.text)).toEqual([
      'Hollowmere, October 1891.',
      'The parish wrote: the keeper, Elias Thorne, has not been seen in three weeks.',
      'They need someone to tend the dead.',
      'The graves here are opening. From the inside.',
      'Elias left a page on the table.',
    ])
  })

  it('has a burst on shot 4 only, inside its duration', () => {
    expect(INTRO_SHOTS.filter((s) => s.burst).map((s) => s.id)).toEqual([4])
    expect(INTRO_SHOTS[3].burst!.at).toBeLessThan(INTRO_SHOTS[3].duration)
  })

  it('enters the hut through the +Z door line and ends at the spawn eye', () => {
    const pts = INTRO_SHOTS[4].camera.position
    for (const p of pts) expect(Math.abs(p[0])).toBeLessThan(0.7) // door is 1.4 m wide
    expect(pts[0][2]).toBeGreaterThan(HUT.halfZ)
    expect(pts[pts.length - 1]).toEqual(INTRO_END_POSE.position)
  })

  it('end-pose eye is (0, 1.65, 0), level, looking at page 1 on the side table; fade >= 0.5 s', () => {
    expect(INTRO_END_POSE.position).toEqual([0, 1.65, 0])
    const [tx, ty, tz] = INTRO_END_POSE.target
    expect(ty).toBe(1.65)
    // Same direction as SPAWN_YAW, so the intro hands over to the player without a jump.
    expect(Math.atan2(-tx, -tz)).toBeCloseTo(SPAWN_YAW, 9)
    const page = FIXED_SPAWNS.find((f) => f.id === 'fx-page-1')!.position
    const toPage = Math.atan2(-page[0], -page[2])
    expect(SPAWN_YAW).toBeCloseTo(toPage, 9)
    expect(INTRO_SHOTS[4].camera.target[INTRO_SHOTS[4].camera.target.length - 1]).toEqual(INTRO_END_POSE.target)
    expect(INTRO_FADE_S).toBeGreaterThanOrEqual(0.5)
  })

  it('a new run starts facing the side table, not the bench', () => {
    resetRun()
    expect(usePlayerStore.getState().yaw).toBe(SPAWN_YAW)
    // Page 1 at (2.6, -1.3): forward (-sin yaw, -cos yaw) points into +X and -Z.
    expect(-Math.sin(SPAWN_YAW)).toBeGreaterThan(0)
    expect(-Math.cos(SPAWN_YAW)).toBeLessThan(0)
  })

  // The bank outside the front fence, measured from graveyard.glb along x = 0 (ground height by
  // z). Shot 1 starts out there; at a fixed 2.5 m it began under the bank and the player saw
  // through the back of the terrain.
  const FRONT_BANK: readonly (readonly [number, number])[] = [
    [44, 0], [46, 0.11], [48, 0.47], [50, 0.92], [52, 1.48], [54, 2.22],
    [56, 3.03], [58, 3.92], [60, 4.88], [62, 5.84], [64, 6.79],
  ]
  const groundAt = (z: number): number => {
    if (z <= FRONT_BANK[0][0]) return 0
    for (let i = 1; i < FRONT_BANK.length; i++) {
      const [z1, y1] = FRONT_BANK[i]
      const [z0, y0] = FRONT_BANK[i - 1]
      if (z <= z1) return y0 + ((z - z0) / (z1 - z0)) * (y1 - y0)
    }
    return FRONT_BANK[FRONT_BANK.length - 1][1]
  }

  it('keeps every camera at least 1.5 m from a tree trunk', () => {
    const trees = generateTrees()
    for (const s of INTRO_SHOTS) {
      for (let k = 0; k <= 100; k++) {
        const [x, , z] = samplePath(s.camera.position, k / 100)
        for (const t of trees) {
          expect(Math.hypot(t.position[0] - x, t.position[2] - z), `shot ${s.id} at ${k}% near ${t.kind}`).toBeGreaterThanOrEqual(1.5)
        }
      }
    }
  })

  it('starts each flowing shot where the one before it ended', () => {
    INTRO_SHOTS.forEach((s, i) => {
      if (!s.flow) return
      const next = INTRO_SHOTS[i + 1]
      expect(next.camera.position[0]).toEqual(s.camera.position[s.camera.position.length - 1])
      expect(next.camera.target[0]).toEqual(s.camera.target[s.camera.target.length - 1])
    })
    expect(INTRO_SHOTS.map((s) => Boolean(s.flow))).toEqual([true, true, true, false, false])
  })

  it('keeps every camera at least 1.5 m above the ground, the front bank included', () => {
    for (const s of INTRO_SHOTS) {
      for (let k = 0; k <= 100; k++) {
        const [, y, z] = samplePath(s.camera.position, k / 100)
        expect(y - groundAt(z), `shot ${s.id} at ${k}%`).toBeGreaterThanOrEqual(1.5)
      }
    }
  })
})
