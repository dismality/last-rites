import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { DEAD_NAMES } from '../../data/cases'
import { NAME_THE_DEAD } from '../../data/nameTheDead'
import { WAVE_GRAVES } from '../../data/waves'
import {
  createNameHold,
  glowingGrave,
  isNameKnown,
  nameHoldProgress,
  namesForStage,
  openGraves,
  tickNameHold,
  type NameHold,
  type NameHoldEvent,
} from './nameTheDead'

const DT = 0.05
const FULL = Math.round(NAME_THE_DEAD.holdS / DT)

/** Holds for `ticks` steps on one grave; a hit lands on step `hitAt` (1-based) if given. */
function hold(ticks: number, hitAt: number | null, known: boolean): NameHoldEvent[] {
  let s: NameHold = createNameHold()
  const events: NameHoldEvent[] = []
  for (let t = 1; t <= ticks; t++) {
    const r = tickNameHold(s, DT, { held: true, target: 'wg-north', known, hit: hitAt === t })
    s = r.state
    if (r.event) events.push(r.event)
  }
  return events
}

describe('Name the Dead', () => {
  it('Property 24: the grave is sealed iff the hold lasted 3 s without damage and the name is known', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: FULL * 2 }),
        fc.option(fc.integer({ min: 1, max: FULL * 2 }), { nil: null }),
        fc.boolean(),
        (ticks, hitAt, known) => {
          const sealed = hold(ticks, hitAt, known).includes('sealed')
          const struckFirst = hitAt !== null && hitAt <= Math.min(ticks, FULL)
          expect(sealed).toBe(known && ticks >= FULL && !struckFirst)
        },
      ),
    )
  })

  it('an unknown name says so once and never seals (Req 28.4)', () => {
    expect(hold(FULL * 2, null, false)).toEqual(['unknown'])
  })

  it('damage mid-hold cancels it; holding on does not restart it (Req 28.3)', () => {
    expect(hold(FULL * 2, 10, true)).toEqual(['struck'])
  })

  it('letting go or turning to another grave starts the hold afresh', () => {
    let s = createNameHold()
    s = tickNameHold(s, DT, { held: true, target: 'wg-north', known: true, hit: false }).state
    expect(nameHoldProgress(s)).toBeGreaterThan(0)
    s = tickNameHold(s, DT, { held: true, target: 'wg-east', known: true, hit: false }).state
    expect(s.target).toBe('wg-east')
    expect(s.heldS).toBeCloseTo(DT)
    s = tickNameHold(s, DT, { held: false, target: 'wg-east', known: true, hit: false }).state
    expect(s).toEqual(createNameHold())
  })

  it('one grave glows per wave from Stage 2, the same for the same seed (Req 28.1)', () => {
    expect(glowingGrave(7, 1, 0, WAVE_GRAVES)).toBeNull()
    const a = glowingGrave(7, 2, 3, WAVE_GRAVES)
    expect(a).not.toBeNull()
    expect(glowingGrave(7, 2, 3, WAVE_GRAVES)).toEqual(a)
    expect(WAVE_GRAVES.map((g) => g.id)).toContain(a!.graveId)
    expect(namesForStage(2).map((n) => n.name)).toContain(a!.name)
    const picks = new Set(Array.from({ length: 40 }, (_, w) => glowingGrave(7, 3, w, WAVE_GRAVES)!.graveId))
    expect(picks.size).toBeGreaterThan(1)
  })

  it('Stage 3 adds its names; Stage 2 shows none of them', () => {
    const s2 = namesForStage(2).map((n) => n.name)
    expect(s2).not.toContain('Elias Thorne')
    expect(namesForStage(3).map((n) => n.name)).toContain('Elias Thorne')
  })

  it('a name is known once a clue naming it is found; strangers never are', () => {
    expect(isNameKnown('Tobias Hale', [])).toBe(false)
    expect(isNameKnown('Tobias Hale', ['hale-fresh-flowers'])).toBe(true)
    const strangers = DEAD_NAMES.filter((n) => n.clues.length === 0)
    expect(strangers.length).toBeGreaterThan(0)
    const all = DEAD_NAMES.flatMap((n) => n.clues)
    for (const s of strangers) expect(isNameKnown(s.name, all)).toBe(false)
  })

  it('a grave sealed for this wave does not open; next wave it may', () => {
    const sealed = { graveId: 'wg-north', wave: 2 }
    expect(openGraves(WAVE_GRAVES, sealed, 2).map((g) => g.id)).not.toContain('wg-north')
    expect(openGraves(WAVE_GRAVES, sealed, 3)).toBe(WAVE_GRAVES)
    expect(openGraves(WAVE_GRAVES, null, 2)).toBe(WAVE_GRAVES)
  })
})
