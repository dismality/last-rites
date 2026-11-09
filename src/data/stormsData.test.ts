import { describe, expect, it } from 'vitest'
import { CAPTIONS, SILENT_CAPTION_EVENTS } from './captions'
import { SOUND_IDS, SOUND_RECIPES, type SoundId } from './sounds'
import { LIGHTNING, RAIN, STORM, STORM_CHANCE_DAY, STORM_CHANCE_NIGHT } from './storms'

describe('storm data (§12 Storms)', () => {
  it('matches the night chances', () => {
    expect(STORM_CHANCE_NIGHT).toEqual({ 1: 0, 2: 0.25, 3: 0.4, 4: 0.5, 5: 1 })
  })

  it('has a 15% day chance', () => {
    expect(STORM_CHANCE_DAY).toBe(0.15)
  })

  it('matches the lightning, thunder and modifier values', () => {
    expect(STORM).toMatchObject({
      gapMinS: 20,
      gapMaxS: 45,
      thunderMinS: 1,
      thunderMaxS: 4,
      fogAdd: 0.01,
      lanternDrainMult: 1.2,
      closeThunderMaxS: 2,
      rainFadeS: 3,
    })
    expect(LIGHTNING).toMatchObject({ flashS: 0.15, slowRiseS: 1.5, slowPeak: 0.3, slowFallS: 1.5 })
    expect(LIGHTNING.holdBeforeBeatS).toBe(1.5)
  })

  it('matches the rain box', () => {
    expect(RAIN.count).toBe(600)
    expect([...RAIN.boxM]).toEqual([36, 20, 36])
  })
})

describe('storm sounds and captions', () => {
  const stormSounds: SoundId[] = ['thunder-close', 'thunder-far', 'rain-noise']

  it('gives every new SoundId a recipe keyed by its own id', () => {
    for (const id of stormSounds) {
      expect(SOUND_IDS, id).toContain(id)
      expect(SOUND_RECIPES[id].id).toBe(id)
      expect(SOUND_RECIPES[id].layers.length).toBeGreaterThan(0)
    }
  })

  it('captions both thunders as "[thunder]"', () => {
    for (const event of ['thunder-close', 'thunder-far']) {
      expect(CAPTIONS.find((c) => c.event === event)?.text).toBe('[thunder]')
    }
  })

  it('maps every spec 08 caption to a sound or a silent event with the bible text', () => {
    const texts: Record<string, string> = {
      'merchant-arrive': '[a hearse cart creaks to the gate]',
      'merchant-leave': '[the hearse cart rolls away]',
      'coins-collected': '[+N grave coins]',
      'contract-done': '[contract done: NAME]',
      'achievement-unlocked': '[achievement: NAME]',
    }
    for (const [event, text] of Object.entries(texts)) {
      expect(SILENT_CAPTION_EVENTS as readonly string[], event).toContain(event)
      expect(CAPTIONS.find((c) => c.event === event)?.text, event).toBe(text)
    }
    for (const c of CAPTIONS) {
      const known =
        (SOUND_IDS as readonly string[]).includes(c.event) ||
        (SILENT_CAPTION_EVENTS as readonly string[]).includes(c.event)
      expect(known, c.id).toBe(true)
    }
  })
})
