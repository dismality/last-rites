// Checkpoint integration tests — spec 05-mystery-scares, Task 10.
//
// Headless stand-in for a human playthrough: drives nights 1-5 through the day/night
// system, collects pages and relics, performs the final rite and checks all three endings.
// A second block runs the scare director at intensity 'off'. It CANNOT verify rendering,
// audio or feel in a real browser.

import { describe, it, expect } from 'vitest'
import { createRng } from '../src/game/rng'
import { tickDayNight } from '../src/game/systems/dayNight'
import {
  collectPage,
  collectRelic,
  chooseEnding,
  createMysteryState,
  type MysteryState,
} from '../src/game/systems/mystery'
import { countRelics, riteAvailability } from '../src/game/systems/finalRite'
import { EMPTY_RITE, isRiteDone, placeRelic } from '../src/game/systems/rite'
import { RITE_ORDER } from '../src/data/relics'
import {
  capScareDamage,
  createScareDirectorState,
  FIRST_SCARE_ZONE_ID,
  tickScares,
  type ScareContext,
  type ScareCue,
} from '../src/game/systems/scareDirector'
import { slowFactor } from '../src/game/systems/scareStaging'
import { SCARE_EVENT_MAP, SCARE_ZONES } from '../src/data/scares'
import { ENDINGS, MAX_ENDING_SECONDS } from '../src/data/endings'
import { LAST_NIGHT } from '../src/data/balance'
import type { EndingId, PageNumber, RelicId, WorldState } from '../src/game/types'

const ALL_RELICS: readonly RelicId[] = [
  'crane-rosary',
  'sextons-bell-clapper',
  'childs-locket',
  'burial-shroud',
  'reliquary-heart',
]

/** Plays one full day -> dusk -> night -> dawn cycle; returns the world at the next day. */
function playNight(world: WorldState): { world: WorldState; sawNightFor: number } {
  let w = world
  let sawNightFor = -1
  // Step in 1 s ticks (the cycle is long); waves are reported cleared once night begins.
  for (let i = 0; i < 2000; i++) {
    const r = tickDayNight(w, 1, { wavesCleared: w.phase === 'night' })
    for (const e of r.events) if (e.type === 'nightStarted') sawNightFor = e.nightNumber
    const wasDawn = w.phase === 'dawn'
    w = r.state
    if (wasDawn && w.phase === 'day') return { world: w, sawNightFor }
  }
  throw new Error('night never ended')
}

/** Plays nights 1-5 collecting `relics` (one per night, in order) and a journal page each night. */
function playCampaign(relics: readonly RelicId[]): { mystery: MysteryState; nights: number[] } {
  let world: WorldState = {
    phase: 'day',
    phaseTime: 0,
    nightNumber: 1,
    fogDensity: 0.02,
    wavesCleared: false,
  }
  let mystery = createMysteryState()
  const nights: number[] = []
  for (let n = 1; n <= LAST_NIGHT; n++) {
    mystery = collectPage(mystery, n as PageNumber)
    if (relics[n - 1]) mystery = collectRelic(mystery, relics[n - 1])
    const r = playNight(world)
    nights.push(r.sawNightFor)
    world = r.world
  }
  return { mystery, nights }
}

/**
 * The last night: lay the relics held on the altar in rite order (spec 10 task 4.5) with Father
 * Crane fallen, and return the ending the finished rite gives. Fewer than five relics never
 * finish it (Req 17.6), so there is no ending to return.
 */
function performRite(mystery: MysteryState): EndingId | undefined {
  const availability = riteAvailability({
    nightNumber: LAST_NIGHT,
    phase: 'night',
    // This checkpoint drives the legacy five-night day/night path, whose rite night is the fifth.
    finalNight: LAST_NIGHT,
  })
  if (availability !== 'ready') return undefined
  let rite = EMPTY_RITE
  RITE_ORDER.forEach((relic, slot) => {
    if (mystery.relics.has(relic)) rite = placeRelic(rite, slot, relic, RITE_ORDER, false).state
  })
  return isRiteDone(rite, RITE_ORDER, false) ? chooseEnding(countRelics([], mystery.relics)) : undefined
}
describe('mystery checkpoint — nights 1-5 reach each ending', () => {
  it('runs all five nights in order and collects all five pages', () => {
    const { mystery, nights } = playCampaign(ALL_RELICS)
    expect(nights).toEqual([1, 2, 3, 4, 5])
    expect(mystery.pages.size).toBe(5)
  })

  it.each([
    [5, 'rest'],
    [4, undefined],
    [3, undefined],
    [2, undefined],
    [1, undefined],
    [0, undefined],
  ] as const)('%i relics -> %s ending', (count, expected) => {
    const { mystery } = playCampaign(ALL_RELICS.slice(0, count))
    expect(countRelics([], mystery.relics)).toBe(count)
    expect(performRite(mystery)).toBe(expected)
  })

  it('has a defined sequence for every ending, within the length cap', () => {
    for (const id of ['rest', 'taken'] as const) {
      const def = ENDINGS.find((e) => e.id === id)
      expect(def).toBeDefined()
      expect(def!.duration).toBeLessThanOrEqual(MAX_ENDING_SECONDS)
    }
  })

  it('keeps the placed relics when the player steps away, and finishes only with Crane fallen', () => {
    const { mystery } = playCampaign(ALL_RELICS)
    let rite = EMPTY_RITE
    RITE_ORDER.forEach((relic, slot) => {
      rite = placeRelic(rite, slot, relic, RITE_ORDER, true).state
    })
    expect(isRiteDone(rite, RITE_ORDER, true)).toBe(false)
    expect(isRiteDone(rite, RITE_ORDER, false)).toBe(true)
    expect(mystery.ending).toBeUndefined()
  })
})

describe('scare director at intensity off', () => {
  const ctx = (over: Partial<ScareContext> = {}): ScareContext => ({
    enteredZones: [],
    lanternFuel: 100,
    phase: 'night',
    nearCandle: false,
    uiBlocking: false,
    intensity: 'off',
    cameraShakeEnabled: true,
    ...over,
  })

  function run(intensity: 'off' | 'full'): ScareCue[] {
    const rng = createRng(42)
    let state = createScareDirectorState()
    const cues: ScareCue[] = []
    // Opener first, then walk every zone repeatedly for ~10 minutes of game time.
    const zoneIds = [FIRST_SCARE_ZONE_ID, ...SCARE_ZONES.map((z) => z.id)]
    for (let step = 0; step < 600; step++) {
      const r = tickScares(state, 1, ctx({ intensity, enteredZones: [zoneIds[step % zoneIds.length]] }), rng)
      state = r.state
      cues.push(...r.cues)
    }
    return cues
  }

  it('still fires events (the first being the mild statue-turn) when intensity is off', () => {
    const off = run('off')
    expect(off.length).toBeGreaterThan(0)
    expect(off[0].eventId).toBe('statue-turn')
    // Same seed, same schedule: gameplay is identical to Full.
    expect(off.map((c) => [c.eventId, c.phase, c.at])).toEqual(
      run('full').map((c) => [c.eventId, c.phase, c.at]),
    )
  })

  it('every cue at off has no stinger, no shake, an always-on subtitle and a telegraph lead', () => {
    for (const cue of run('off')) {
      expect(cue.intensityProfile.stingerVolume).toBe(0)
      expect(cue.intensityProfile.cameraShake).toBe(false)
      expect(cue.intensityProfile.subtitle).toBe('always')
      expect(SCARE_EVENT_MAP[cue.eventId].subtitle.length).toBeGreaterThan(0)
    }
    const telegraphs = run('off').filter((c) => c.phase === 'telegraph')
    expect(telegraphs.length).toBeGreaterThan(0)
  })

  it('gameplay effects remain: hand slows the player, damage can never kill', () => {
    expect(slowFactor(1)).toBe(0.5)
    expect(slowFactor(0)).toBe(1)
    expect(capScareDamage(10, 999)).toBe(9)
    expect(capScareDamage(1, 20)).toBe(0)
  })

  it('does not fire while a menu is open', () => {
    const r = tickScares(
      createScareDirectorState(),
      1,
      ctx({ enteredZones: [FIRST_SCARE_ZONE_ID], uiBlocking: true }),
      createRng(1),
    )
    expect(r.cues).toEqual([])
  })
})
