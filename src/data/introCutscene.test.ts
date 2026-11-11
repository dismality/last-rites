import { describe, expect, it } from 'vitest'
import { INTRO_END_POSE, INTRO_FADE_S, INTRO_SHOTS } from './introCutscene'
import { HUT } from './cemeteryLayout'
import { SPAWN_YAW } from './spawn'
import { FIXED_SPAWNS } from './zones'
import { resetRun } from '../game/state/resetRun'
import { usePlayerStore } from '../game/state/playerStore'

describe('introCutscene data', () => {
  it('has 5 shots in order totalling 32-38 s', () => {
    expect(INTRO_SHOTS.map((s) => s.id)).toEqual([1, 2, 3, 4, 5])
    const total = INTRO_SHOTS.reduce((t, s) => t + s.duration, 0)
    expect(total).toBeGreaterThanOrEqual(32)
    expect(total).toBeLessThanOrEqual(38)
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
})
