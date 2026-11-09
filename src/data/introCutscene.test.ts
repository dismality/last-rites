import { describe, expect, it } from 'vitest'
import { INTRO_END_POSE, INTRO_FADE_S, INTRO_SHOTS } from './introCutscene'
import { HUT } from './cemeteryLayout'

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
      'Elias left a page on the shelf.',
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

  it('end-pose eye is (0, 1.65, 0) looking along -Z; fade >= 0.5 s', () => {
    expect(INTRO_END_POSE.position).toEqual([0, 1.65, 0])
    expect(INTRO_END_POSE.target).toEqual([0, 1.65, -3])
    expect(INTRO_FADE_S).toBeGreaterThanOrEqual(0.5)
  })
})
