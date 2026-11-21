import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { INTRO_END_POSE, INTRO_FADE_S, INTRO_SHOTS } from '../../data/introCutscene'
import { advanceIntro, introDuration, introStateAt } from './introTimeline'

const TOTAL_MS = Math.round(introDuration() * 1000)

describe('introTimeline', () => {
  it('lasts about 20 s (21 s) with five shots', () => {
    expect(introDuration()).toBe(21)
    expect(INTRO_SHOTS).toHaveLength(5)
  })

  it('starts at shot 0 under full ink and ends at the player view', () => {
    const a = introStateAt(0)
    expect(a.shot).toBe(0)
    expect(a.fade).toBe(1)
    expect(a.done).toBe(false)
    const z = introStateAt(introDuration())
    expect(z.done).toBe(true)
    expect(z.shot).toBe(4)
    expect(z.fade).toBe(0)
    expect(z.position).toEqual(INTRO_END_POSE.position)
    expect(z.target).toEqual(INTRO_END_POSE.target)
  })

  it('shows each card text during its shot', () => {
    INTRO_SHOTS.forEach((s, i) => {
      const start = INTRO_SHOTS.slice(0, i).reduce((n, x) => n + x.duration, 0)
      const st = introStateAt(start + s.card.at + s.card.hold / 2)
      expect(st.card?.text).toBe(s.card.text)
      expect(st.card?.opacity).toBe(1)
    })
  })

  it('flows from the fence to the open grave with no ink, then dips once into the hut', () => {
    const boundary = (i: number) => INTRO_SHOTS.slice(0, i + 1).reduce((n, x) => n + x.duration, 0)
    // Shots 1-3 run on into the next shot: no ink either side of the join, and no jump in the pose.
    for (const i of [0, 1, 2]) {
      const t = boundary(i)
      expect(introStateAt(t - 0.01).fade, `end of shot ${i + 1}`).toBe(0)
      expect(introStateAt(t + 0.01).fade, `start of shot ${i + 2}`).toBe(0)
      const a = introStateAt(t - 1e-6)
      const b = introStateAt(t + 1e-6)
      for (let k = 0; k < 3; k++) {
        expect(Math.abs(a.position[k] - b.position[k])).toBeLessThan(0.01)
        expect(Math.abs(a.target[k] - b.target[k])).toBeLessThan(0.01)
      }
    }
    // The grave shot ends in ink and the hut shot comes up out of it.
    expect(introStateAt(boundary(3) - 0.01).fade).toBeGreaterThan(0.9)
    expect(introStateAt(boundary(3) + 0.01).fade).toBeGreaterThan(0.9)
  })

  it('does not advance while paused and caps at the total', () => {
    expect(advanceIntro(3.2, 0.5, true)).toBe(3.2)
    expect(advanceIntro(20.9, 5, false)).toBe(21)
  })

  // Feature: 06-clarity-and-hud, Property 27: Intro timeline
  // **Validates: Requirements 8.8, 8.13, 8.17**
  it('Property 27: finite pose, monotonic shot, bounded fade rate, paused time frozen', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: TOTAL_MS }),
        fc.integer({ min: 1, max: 500 }),
        fc.double({ min: 0, max: 1000, noNaN: true }),
        (ms, stepMs, dt) => {
          const t = ms / 1000
          const t2 = Math.min(TOTAL_MS, ms + stepMs) / 1000
          const a = introStateAt(t)
          const b = introStateAt(t2)
          for (const v of [...a.position, ...a.target]) expect(Number.isFinite(v)).toBe(true)
          expect(b.shot).toBeGreaterThanOrEqual(a.shot)
          const rate = Math.abs(b.fade - a.fade) / (t2 - t || 1)
          expect(rate).toBeLessThanOrEqual(1 / INTRO_FADE_S + 1e-6)
          expect(advanceIntro(t, dt, true)).toBe(t)
        },
      ),
      { numRuns: 200 },
    )
  })
})
