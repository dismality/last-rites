import { describe, expect, it } from 'vitest'
import { ENDINGS } from '../../data/endings'
import { activeLine, cameraProgress, easeInOut, fadeAlpha, FADE_S, isSequenceDone } from './endingSequence'

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
