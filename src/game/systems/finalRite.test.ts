import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { ENDINGS, ENDING_MAP, MAX_ENDING_SECONDS } from '../../data/endings'
import { parseCredits } from './credits'
import { activeLine, cameraProgress, fadeAlpha } from './endingSequence'
import { isHoldingRite, riteAvailability, stepRite, type RiteContext } from './finalRite'
import { createMysteryState, RITE_DURATION } from './mystery'
import { createRunStats, finalizeStats, recordBanished, recordNightSurvived } from './runStats'
import { startRiteAssault } from './waves'

const night5 = (over: Partial<RiteContext> = {}): RiteContext => ({
  nightNumber: 3,
  phase: 'night',
  wavesCleared: false,
  relicCount: 0,
  ...over,
})

describe('riteAvailability', () => {
  it('needs the last stage at night', () => {
    expect(riteAvailability(night5({ relicCount: 5, nightNumber: 2 }))).toBe('unavailable')
    expect(riteAvailability(night5({ relicCount: 5, phase: 'day' }))).toBe('unavailable')
  })

  it('is ready with 3+ relics, even before the waves are cleared (Req 5.2)', () => {
    expect(riteAvailability(night5({ relicCount: 3 }))).toBe('ready')
    expect(riteAvailability(night5({ relicCount: 3, wavesCleared: true }))).toBe('ready')
  })

  it('is taken only once waves clear with fewer than 3 relics (Req 5.5)', () => {
    expect(riteAvailability(night5({ relicCount: 2 }))).toBe('unavailable')
    expect(riteAvailability(night5({ relicCount: 2, wavesCleared: true }))).toBe('taken')
  })
})

describe('isHoldingRite', () => {
  const base = { availability: 'ready', nearAltar: true, interactHeld: true, blocked: false } as const
  it('holds only when every condition is met', () => {
    expect(isHoldingRite(base)).toBe(true)
    expect(isHoldingRite({ ...base, nearAltar: false })).toBe(false)
    expect(isHoldingRite({ ...base, interactHeld: false })).toBe(false)
    expect(isHoldingRite({ ...base, blocked: true })).toBe(false)
    expect(isHoldingRite({ ...base, availability: 'unavailable' })).toBe(false)
  })
})

describe('stepRite', () => {
  it('pauses on release without resetting (Req 5.3)', () => {
    let m = stepRite(createMysteryState(), 20, true, 5).mystery
    m = stepRite(m, 10, false, 5).mystery
    expect(m.riteProgress).toBe(20)
  })

  it('completes at 45 s of holding with the ending for the relic count (Req 5.4)', () => {
    const r = stepRite(createMysteryState(), RITE_DURATION, true, 5)
    expect(r.completed).toBe(true)
    expect(r.mystery.ending).toBe('rest')
    expect(stepRite(createMysteryState(), RITE_DURATION, true, 4).mystery.ending).toBe('uneasy-peace')
  })

  // **Validates: Requirements 5.3, 5.4**
  it('property: the ending always follows chooseEnding and never changes once set', () => {
    fc.assert(
      fc.property(fc.integer({ min: 3, max: 5 }), fc.array(fc.double({ min: 0, max: 20, noNaN: true }), { maxLength: 12 }), (relics, dts) => {
        let m = createMysteryState()
        let ended = m.ending
        for (const dt of dts) {
          m = stepRite(m, dt, true, relics).mystery
          if (ended) expect(m.ending).toBe(ended)
          ended = m.ending
        }
        if (ended) expect(ended).toBe(relics === 5 ? 'rest' : 'uneasy-peace')
      }),
    )
  })
})

describe('stepRite cap', () => {
  it('stops at the cap and does not complete', () => {
    const r = stepRite(createMysteryState(), 60, true, 5, 44)
    expect(r.mystery.riteProgress).toBe(44)
    expect(r.completed).toBe(false)
    expect(r.mystery.ending).toBeUndefined()
  })

  it('completes once the cap lifts to 45', () => {
    const held = stepRite(createMysteryState(), 60, true, 5, 44).mystery
    expect(stepRite(held, 1, true, 5, 45).completed).toBe(true)
  })

  // **Validates: Requirements 17.5, 17.18**
  it('property 28: capped progress stays at most the cap, never drops, and finishes only uncapped', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 45, noNaN: true }),
        fc.array(fc.tuple(fc.double({ min: 0, max: 10, noNaN: true }), fc.boolean()), { maxLength: 20 }),
        (start, steps) => {
          let m = { ...createMysteryState(), riteProgress: Math.min(start, 44) }
          for (const [dt, hold] of steps) {
            const before = m.riteProgress
            const r = stepRite(m, dt, hold, 5, 44)
            expect(r.mystery.riteProgress).toBeLessThanOrEqual(44)
            expect(r.mystery.riteProgress).toBeGreaterThanOrEqual(before)
            expect(r.completed).toBe(false)
            m = r.mystery
          }
        },
      ),
    )
  })

  it('never lowers progress already above the cap', () => {
    const above = { ...createMysteryState(), riteProgress: 45 - 0.5 }
    expect(stepRite(above, 1, true, 5, 44).mystery.riteProgress).toBe(44.5)
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
    expect(ENDINGS).toHaveLength(3)
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
    // 8 shamblers, 2 wailers, 2 lurkers, plus 2 bloaters and 1 brute added by spec 07.
    expect(w.pending).toHaveLength(15)
  })
})
