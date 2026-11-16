import { describe, expect, it } from 'vitest'
import { ENDING_MAP } from '../../data/endings'
import { advanceSequence, fadeAlpha, activeLine } from './endingSequence'
import {
  activeCaption,
  gateOpenAngle,
  gateTime,
  handleWinKey,
  sunProgress,
  walkBob,
  WIN_SKIP_TARGET,
  winPose,
  winSequenceFor,
  winSkyBlend,
} from './winSequence'
import { WIN_GATE, WIN_SEQUENCE, WIN_SEQUENCE_STILL } from '../../data/winCutscene'

const key = (k: string) => {
  let prevented = false
  return { e: { key: k, preventDefault: () => (prevented = true) }, prevented: () => prevented }
}

describe('win sequence (Req 23)', () => {
  it('lasts 15 to 20 s in both variants', () => {
    for (const def of [WIN_SEQUENCE, WIN_SEQUENCE_STILL]) {
      expect(def.duration).toBeGreaterThanOrEqual(15)
      expect(def.duration).toBeLessThanOrEqual(20)
    }
  })

  it('runs on the ending clock: a pause holds it, and it ends at its duration', () => {
    let t = 0
    let done = false
    for (let i = 0; i < 2000 && !done; i++) ({ time: t, done } = advanceSequence(WIN_SEQUENCE, t, 1 / 60))
    expect(done).toBe(true)
    expect(t).toBe(WIN_SEQUENCE.duration)
    expect(advanceSequence(WIN_SEQUENCE, 5, 0.5, true)).toEqual({ time: 5, done: false })
  })

  it('fades in from black and out to black, slower when reduced', () => {
    expect(fadeAlpha(WIN_SEQUENCE, 0)).toBe(1)
    expect(fadeAlpha(WIN_SEQUENCE, WIN_SEQUENCE.duration / 2)).toBe(0)
    expect(fadeAlpha(WIN_SEQUENCE, WIN_SEQUENCE.duration)).toBe(1)
    // 1.5 s in, the full fade is done but the reduced one is still dark.
    expect(fadeAlpha(WIN_SEQUENCE, 1.5)).toBe(0)
    expect(fadeAlpha(WIN_SEQUENCE_STILL, 1.5)).toBeGreaterThan(0.3)
    // The ending fades are untouched (FADE_S = 1.5 when no fadeS is given).
    expect(fadeAlpha(ENDING_MAP.rest, 0.75)).toBeCloseTo(0.5)
  })

  it('walks south down the grounds, out through the gate, at eye height', () => {
    const start = winPose(WIN_SEQUENCE_STILL, 0).position
    const end = winPose(WIN_SEQUENCE_STILL, WIN_SEQUENCE_STILL.duration).position
    expect(start[2]).toBeLessThan(10)
    expect(end[2]).toBeGreaterThan(WIN_GATE.z + 5)
    let lastZ = -Infinity
    for (let t = 0; t <= WIN_SEQUENCE_STILL.duration; t += 0.25) {
      const p = winPose(WIN_SEQUENCE_STILL, t).position
      expect(p[1]).toBeGreaterThan(1.5)
      expect(p[1]).toBeLessThan(1.8)
      expect(p[2]).toBeGreaterThanOrEqual(lastZ - 1e-9)
      lastZ = p[2]
      // Where it crosses the fence line, it is inside the gate opening.
      if (Math.abs(p[2] - WIN_GATE.z) < WIN_GATE.halfDepth) expect(Math.abs(p[0] - WIN_GATE.x)).toBeLessThan(WIN_GATE.halfWidth - 0.5)
    }
  })

  it('reaches the gate in the second half, and the gate is open before the keeper gets there', () => {
    const at = gateTime(WIN_SEQUENCE)
    expect(at).toBeGreaterThan(WIN_SEQUENCE.duration * 0.5)
    expect(at).toBeLessThan(WIN_SEQUENCE.duration * 0.85)
    expect(gateOpenAngle(WIN_SEQUENCE, 0)).toBe(0)
    expect(gateOpenAngle(WIN_SEQUENCE, at - 0.5)).toBeCloseTo(WIN_GATE.openAngle)
    // The creak caption is up while the gate swings.
    expect(activeCaption(WIN_SEQUENCE, at - 1.5)?.text).toMatch(/gate creaks/)
  })

  it('bobs only in full motion, and is still at both ends', () => {
    expect(walkBob(WIN_SEQUENCE_STILL, 7.3)).toEqual([0, 0])
    expect(walkBob(WIN_SEQUENCE, 0)).toEqual([0, 0])
    const [, lift] = walkBob(WIN_SEQUENCE, WIN_SEQUENCE.duration)
    expect(Math.abs(lift)).toBeLessThan(1e-9)
    const lifts = Array.from({ length: 40 }, (_, i) => walkBob(WIN_SEQUENCE, 6 + i * 0.05)[1])
    expect(Math.max(...lifts)).toBeGreaterThan(0.01)
    expect(Math.max(...lifts)).toBeLessThanOrEqual(WIN_SEQUENCE.bob!.lift)
  })

  it('uses the steady variant under reduced motion or with Camera shake off (Req 23.5)', () => {
    expect(winSequenceFor(false, true)).toBe(WIN_SEQUENCE)
    expect(winSequenceFor(true, true)).toBe(WIN_SEQUENCE_STILL)
    expect(winSequenceFor(false, false)).toBe(WIN_SEQUENCE_STILL)
    expect(WIN_SEQUENCE_STILL.camera).toBe(WIN_SEQUENCE.camera)
  })

  it('captions every sound and never overlaps two captions or two lines (Req 23.6)', () => {
    for (const track of [WIN_SEQUENCE.captions, WIN_SEQUENCE.lines]) {
      for (let i = 1; i < track.length; i++) expect(track[i].at).toBeGreaterThanOrEqual(track[i - 1].at + track[i - 1].hold)
      for (const c of track) expect(c.at + c.hold).toBeLessThanOrEqual(WIN_SEQUENCE.duration)
    }
    for (const c of WIN_SEQUENCE.captions) expect(c.text).toMatch(/^\[.+\]$/)
    expect(activeCaption(WIN_SEQUENCE, WIN_SEQUENCE.tollAt + 0.1)?.text).toMatch(/bell/)
    expect(activeLine(WIN_SEQUENCE, 2)?.text).toMatch(/fog/)
  })

  it('raises the sun and lifts the fog as it goes', () => {
    const base = { sky: [0.2, 0.2, 0.25], ambientColor: [0.5, 0.5, 0.6], ambientIntensity: 0.4, moonIntensity: 0.2, fogDensity: 0.04 } as const
    expect(winSkyBlend(base, 0)).toEqual(base)
    const end = winSkyBlend(base, 1)
    expect(end.fogDensity).toBeCloseTo(0.01)
    expect(end.ambientIntensity).toBeGreaterThan(base.ambientIntensity)
    expect(sunProgress(WIN_SEQUENCE, 0)).toBe(0)
    expect(sunProgress(WIN_SEQUENCE, WIN_SEQUENCE.duration)).toBe(1)
  })

  it('skips with Space or Enter to the card; Escape is left to pause (Req 23.3, 23.4)', () => {
    expect(WIN_SKIP_TARGET).toBe('summary')
    for (const k of [' ', 'Enter']) {
      let skipped = 0
      const { e, prevented } = key(k)
      expect(handleWinKey(e, () => skipped++)).toBe(true)
      expect(skipped).toBe(1)
      expect(prevented()).toBe(true)
    }
    let skipped = 0
    const esc = key('Escape')
    expect(handleWinKey(esc.e, () => skipped++)).toBe(false)
    expect(skipped).toBe(0)
    expect(esc.prevented()).toBe(false)
  })
})
