import { describe, expect, it } from 'vitest'
import { ENDINGS } from '../../data/endings'
import { activeLine, advanceSequence, cameraProgress, easeInOut, fadeAlpha, FADE_S, isSequenceDone } from './endingSequence'

describe('endingSequence', () => {
  it('eases from 0 to 1 and clamps outside the range', () => {
    expect(easeInOut(-1)).toBe(0)
    expect(easeInOut(0.5)).toBe(0.5)
    expect(easeInOut(2)).toBe(1)
  })

  for (const def of ENDINGS) {
    it(`${def.id}: starts and ends black, is clear in the middle and finishes at its duration`, () => {
      expect(fadeAlpha(def, 0)).toBe(1)
      expect(fadeAlpha(def, def.duration)).toBe(1)
      expect(fadeAlpha(def, def.duration / 2)).toBe(0)
      expect(fadeAlpha(def, FADE_S / 2)).toBeCloseTo(0.5, 5)
      expect(cameraProgress(def, def.duration)).toBe(1)
      expect(isSequenceDone(def, def.duration - 0.01)).toBe(false)
      expect(isSequenceDone(def, def.duration)).toBe(true)
    })

    it(`${def.id}: shows each line only inside its window`, () => {
      for (const line of def.lines) {
        expect(activeLine(def, line.at)?.text).toBe(line.text)
        expect(activeLine(def, line.at + line.hold)?.text).not.toBe(line.text)
      }
    })
  }
})

describe('ending driver (no Skip)', () => {
  const DT = 1 / 60
  function run(def: (typeof ENDINGS)[number], pauseFrom = -1, pauseFor = 0): { reached: number; ended: boolean } {
    let time = 0
    let elapsed = 0
    for (let i = 0; i < 60 * 200; i++) {
      elapsed = i * DT
      const paused = pauseFrom >= 0 && elapsed >= pauseFrom && elapsed < pauseFrom + pauseFor
      const r = advanceSequence(def, time, DT, paused)
      time = r.time
      if (r.done) return { reached: elapsed + DT, ended: true }
    }
    return { reached: elapsed, ended: false }
  }

  for (const def of ENDINGS) {
    it(`${def.id}: reaches the end screen on its own in 40-50 s`, () => {
      const r = run(def)
      expect(r.ended).toBe(true)
      expect(r.reached).toBeGreaterThanOrEqual(40)
      expect(r.reached).toBeLessThanOrEqual(50)
    })

    it(`${def.id}: a pause delays the end by its length but does not lose it`, () => {
      const base = run(def).reached
      const r = run(def, 10, 20)
      expect(r.ended).toBe(true)
      expect(r.reached).toBeCloseTo(base + 20, 0)
    })
  }

  it('a slow frame rate does not stretch the sequence', () => {
    const def = ENDINGS[0]
    let time = 0
    let real = 0
    while (!advanceSequence(def, time, 0.2).done) {
      time = advanceSequence(def, time, 0.2).time
      real += 0.2
    }
    expect(real).toBeLessThanOrEqual(def.duration)
  })
})