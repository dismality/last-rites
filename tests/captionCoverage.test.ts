import { describe, expect, it } from 'vitest'
import { CAPTIONS } from '../src/data/captions'
import { SOUND_RECIPES, type SoundId } from '../src/data/sounds'

// Spec 11 Req 6.16 and 8.8: every new sound of the horror pass has a caption that stays at least
// 1.5 s, and a sound from a place in the world plays as 3D audio (Req 8.13). Later tasks (screen
// scares, creatures, bats, the belt lantern) add their ids to this list.
const SPEC_11_SOUNDS: readonly SoundId[] = [
  // Task 2, H6 vending machine.
  'vending-coin',
  'vending-handle',
  'vending-tray',
  'vending-refuse',
]
/** The ones heard from a world position. */
const SPEC_11_WORLD_SOUNDS: readonly SoundId[] = ['vending-coin', 'vending-handle', 'vending-tray', 'vending-refuse']

describe('spec 11 sound and caption coverage', () => {
  // Feature: 11-horror-pass, Property 10: Sound and caption coverage
  it('gives each new sound a caption of at least 1.5 s', () => {
    for (const id of SPEC_11_SOUNDS) {
      const caps = CAPTIONS.filter((c) => c.event === id)
      expect(caps.length, id).toBeGreaterThan(0)
      for (const c of caps) {
        expect(c.minSeconds, id).toBeGreaterThanOrEqual(1.5)
        expect(c.text.trim().length, id).toBeGreaterThan(0)
      }
    }
  })

  it('plays world sounds in 3D', () => {
    for (const id of SPEC_11_WORLD_SOUNDS) {
      expect(SOUND_RECIPES[id].spatial, id).toBe(true)
      expect(SOUND_RECIPES[id].maxDistanceM, id).toBeGreaterThan(0)
    }
  })
})
