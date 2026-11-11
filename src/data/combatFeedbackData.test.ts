import { describe, expect, it } from 'vitest'
import { AIM, DAMAGE_NUMBER, HIT_MARKER, MUZZLE } from './combatFeedback'
import {
  CAPTION_MIN_SECONDS,
  CAPTIONS,
  SILENT_CAPTION_EVENTS,
  type CaptionEvent,
  type CaptionId,
} from './captions'

const SPEC_08_CAPTION_IDS: readonly CaptionId[] = [
  'thunder-close',
  'thunder-far',
  'merchant-arrive',
  'merchant-leave',
  'coins-collected',
  'contract-done',
  'achievement-unlocked',
]
import { SOUND_IDS, SOUND_RECIPES } from './sounds'

// Sounds that must be captioned: the Req 22.1 list plus the bible's extra captions.
const CAPTIONED_EVENTS: readonly CaptionEvent[] = [
  'revolver-shot',
  'shotgun-blast',
  'dry-click',
  'reload',
  'weapon-break',
  'weapon-crack',
  'board-break',
  'bloater-hiss',
  'bloater-burst',
  'brute-grunt',
  'elite-arrival',
  'boss-rise',
  'congregation',
  'toll',
  'boss-death',
]

describe('combat feedback values (design bible)', () => {
  it('hit marker', () => {
    expect(HIT_MARKER).toEqual({ hitS: 0.15, killScale: 1.5, steadyS: 0.3 })
  })
  it('damage numbers', () => {
    expect(DAMAGE_NUMBER).toEqual({ lifeS: 0.8, riseMps: 1.2, max: 24 })
  })
  it('muzzle flash', () => {
    expect(MUZZLE.flashingOn).toEqual({ durationS: 0.06, peak: 1, light: true })
    expect(MUZZLE.flashingOff).toEqual({ durationS: 0.3, peak: 0.35, light: false })
  })
  it('aim', () => {
    expect(AIM).toEqual({ fovDeg: 10, moveMult: 0.7, blendS: 0.12 })
  })
})

describe('captions', () => {
  it('has unique ids', () => {
    expect(new Set(CAPTIONS.map((c) => c.id)).size).toBe(CAPTIONS.length)
  })

  it('maps every caption to a known sound event', () => {
    for (const c of CAPTIONS) {
      const known =
        (SILENT_CAPTION_EVENTS as readonly string[]).includes(c.event) ||
        (SOUND_IDS as readonly string[]).includes(c.event)
      expect(known, `caption ${c.id} -> ${c.event}`).toBe(true)
    }
  })

  it('captions every sound event that needs one', () => {
    const covered = new Set(CAPTIONS.map((c) => c.event))
    for (const e of CAPTIONED_EVENTS) expect(covered.has(e), `no caption for ${e}`).toBe(true)
    // Spec 08 captions are checked in stormsData.test.ts and musicData.test.ts.
    const spec07 = CAPTIONS.filter((c) => !SPEC_08_CAPTION_IDS.includes(c.id))
    for (const c of spec07) expect(CAPTIONED_EVENTS).toContain(c.event)
  })

  it('keeps every caption on screen at least 1.5 s', () => {
    for (const c of CAPTIONS) expect(c.minSeconds).toBeGreaterThanOrEqual(CAPTION_MIN_SECONDS)
  })

  it('uses the bible wording for the fixed captions', () => {
    const text = (id: string) => CAPTIONS.find((c) => c.id === id)?.text
    expect(text('dry-click')).toBe('[click]')
    expect(text('board-break-front')).toBe('[wood splinters at the front door]')
    expect(text('board-break-vestry')).toBe('[wood splinters at the vestry door]')
    expect(text('toll')).toBe('[a great bell tolls]')
    expect(text('boss-rise')).toBe('[stone grinding beneath the altar]')
    expect(text('elite-arrival')).toBe('[something worse rises]')
    expect(CAPTIONS.find((c) => c.id === 'elite-arrival')?.minSeconds).toBe(3)
  })

  it('has no joke or mocking words in Father Crane texts', () => {
    const joke =
      /\b(lol|haha|ha ha|joke|funny|silly|amen,? sucker|pray(ing)? (for|to) (nothing|me)|taunt|mock|hallelujah)\b|!/i
    const crane = CAPTIONS.filter((c) =>
      ['boss-rise', 'congregation', 'toll', 'boss-death'].includes(c.id),
    )
    expect(crane.length).toBe(4)
    for (const c of crane) expect(c.text, c.id).not.toMatch(joke)
  })
})

describe('sound recipes', () => {
  it('has a recipe for every SoundId, keyed by its own id', () => {
    expect(SOUND_IDS.length).toBeGreaterThan(0)
    for (const id of SOUND_IDS) {
      const r = SOUND_RECIPES[id]
      expect(r.id).toBe(id)
      expect(r.layers.length).toBeGreaterThan(0)
      expect(r.decayS).toBeGreaterThan(0)
    }
  })

  it('gives spatial sounds a max distance and flat sounds none', () => {
    for (const r of Object.values(SOUND_RECIPES)) {
      if (r.spatial) expect(r.maxDistanceM, r.id).toBeGreaterThan(0)
      else expect(r.maxDistanceM, r.id).toBe(0)
    }
  })

  it('matches the design table for spatial flags', () => {
    const spatial = [
      'board-break',
      'bloater-hiss',
      'bloater-burst',
      'brute-grunt',
      'brute-step',
      'elite-arrival',
      'boss-rise',
      'congregation',
    ] as const
    for (const id of spatial) expect(SOUND_RECIPES[id].spatial, id).toBe(true)
    for (const id of [
      'revolver-shot',
      'shotgun-blast',
      'dry-click',
      'reload',
      'weapon-break',
      'toll',
    ] as const)
      expect(SOUND_RECIPES[id].spatial, id).toBe(false)
  })
})
