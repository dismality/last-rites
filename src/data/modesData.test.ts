import { describe, expect, it } from 'vitest'
import { DEFAULT_MODE, ENDLESS, ENDLESS_BEST_KEY, MODE_IDS, MODES } from './modes'

describe('mode values (design bible §12)', () => {
  it('Easy, Normal and Hard modifiers', () => {
    const pick = (id: 'easy' | 'normal' | 'hard') => {
      const m = MODES[id]
      return [m.hpMult, m.damageMult, m.lanternDrainMult, m.eliteChance, m.scoreMult]
    }
    expect(pick('easy')).toEqual([0.75, 0.6, 0.75, 0.04, 0.75])
    expect(pick('normal')).toEqual([1, 1, 1, 0.06, 1])
    expect(pick('hard')).toEqual([1.25, 1.4, 1, 0.1, 1.5])
  })

  it('Normal is the default and ids are unique', () => {
    expect(DEFAULT_MODE).toBe('normal')
    expect(new Set(MODE_IDS).size).toBe(MODE_IDS.length)
    for (const id of MODE_IDS) expect(MODES[id].id).toBe(id)
  })

  it('story modes keep Retry Night and the normal day', () => {
    for (const id of ['easy', 'normal', 'hard'] as const) {
      expect(MODES[id].story).toBe(true)
      expect(MODES[id].retryNight).toBe(true)
      expect(MODES[id].dayLengthS).toBeNull()
    }
  })

  it('Endless equals Normal modifiers with a 120 s day and no Retry Night', () => {
    const { hpMult, damageMult, lanternDrainMult, eliteChance, scoreMult } = MODES.normal
    expect(MODES.endless).toMatchObject({
      hpMult,
      damageMult,
      lanternDrainMult,
      eliteChance,
      scoreMult,
      story: false,
      dayLengthS: 120,
      retryNight: false,
    })
    expect(ENDLESS.dayS).toBe(120)
  })

  it('Endless tuning and storage key', () => {
    expect(ENDLESS).toMatchObject({ waveBase: 2, waveCap: 6, shamblerBase: 4, hpScale: 1.08, hpScaleAfterNight: 5 })
    expect(ENDLESS_BEST_KEY).toBe('lastrites:endless-best')
  })
})
