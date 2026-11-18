import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { ENDINGS, ENDING_MAP, MAX_ENDING_SECONDS } from '../../data/endings'
import { parseCredits } from './credits'
import { activeLine, cameraProgress, fadeAlpha } from './endingSequence'
import { countRelics, riteAvailability, type RiteContext } from './finalRite'
import { createRunStats, finalizeStats, recordBanished, recordNightSurvived } from './runStats'
import { startRiteAssault } from './waves'

const stage3 = (over: Partial<RiteContext> = {}): RiteContext => ({
  nightNumber: 3,
  phase: 'night',
  ...over,
})

describe('riteAvailability', () => {
  it('needs the last stage at night', () => {
    expect(riteAvailability(stage3({ nightNumber: 2 }))).toBe('unavailable')
    expect(riteAvailability(stage3({ phase: 'day' }))).toBe('unavailable')
    expect(riteAvailability(stage3({ phase: 'dusk' }))).toBe('unavailable')
  })

  it('is ready on the last stage at night, whatever the relic count (placement is by relic)', () => {
    expect(riteAvailability(stage3())).toBe('ready')
  })

  it('is never ready when the final night is Infinity (Endless)', () => {
    expect(riteAvailability(stage3({ finalNight: Infinity }))).toBe('unavailable')
  })
})

describe('countRelics', () => {
  it('counts the satchel and the mystery record once each', () => {
    expect(countRelics(['crane-rosary', 'childs-locket'], new Set(['crane-rosary', 'burial-shroud']))).toBe(3)
  })
})
describe('run stats', () => {
  it('counts banished zombies and never lowers nights survived', () => {
    let s = recordBanished(recordBanished(createRunStats()))
    s = recordNightSurvived(recordNightSurvived(s, 3), 2)
    expect([s.nightsSurvived, s.zombiesBanished]).toEqual([3, 2])
  })

  it('credits the last stage for completed rites but not for Taken', () => {
    const s = recordNightSurvived(createRunStats(), 2)
    expect(finalizeStats(s, 'rest').nightsSurvived).toBe(3)
    expect(finalizeStats(s, 'taken').nightsSurvived).toBe(2)
  })
})

describe('ending sequences', () => {
  it('each ending is at most 45 s with lines inside its duration (Req 6.1)', () => {
    expect(ENDINGS).toHaveLength(2)
    for (const e of ENDINGS) {
      expect(e.duration).toBeLessThanOrEqual(MAX_ENDING_SECONDS)
      expect(e.camera.position.length).toBe(e.camera.target.length)
      for (const l of e.lines) expect(l.at + l.hold).toBeLessThanOrEqual(e.duration)
      expect(e.lines[e.lines.length - 1].text).toBe(e.closingLine)
    }
  })

  // **Validates: Requirements 6.1**
  it('property: progress stays in 0..1 and fade in 0..1', () => {
    fc.assert(
      fc.property(fc.constantFrom(...ENDINGS), fc.double({ min: -5, max: 60, noNaN: true }), (e, t) => {
        const p = cameraProgress(e, t)
        const f = fadeAlpha(e, t)
        expect(p).toBeGreaterThanOrEqual(0)
        expect(p).toBeLessThanOrEqual(1)
        expect(f).toBeGreaterThanOrEqual(0)
        expect(f).toBeLessThanOrEqual(1)
      }),
    )
  })

  it('shows a line at its start time and none before it', () => {
    const e = ENDING_MAP.rest
    expect(activeLine(e, 0)).toBeNull()
    expect(activeLine(e, e.lines[0].at)?.text).toBe(e.lines[0].text)
  })
})

describe('credits and rite assault', () => {
  it('turns markdown tables into lines and skips header and divider rows', () => {
    const md = '# Credits\nIntro `x`\n| A | B |\n|---|---|\n| one | two |\n## More\n| H |\n|---|\n| row |'
    expect(parseCredits(md)).toEqual([
      { kind: 'heading', text: 'Credits' },
      { kind: 'text', text: 'Intro x' },
      { kind: 'text', text: 'one, two' },
      { kind: 'heading', text: 'More' },
      { kind: 'text', text: 'row' },
    ])
  })

  it('starts one strong night-5 wave', () => {
    const w = startRiteAssault()
    expect(w.phase).toBe('active')
    expect(w.night).toBe(5)
    // 8 shamblers, 2 wailers, 2 lurkers, plus 2 bloaters and 1 brute added by spec 07,
    // and 3 hounds and 1 crawler added by spec 11 (WAVE_EXTRAS).
    expect(w.pending).toHaveLength(19)
  })
})
