import { describe, expect, it } from 'vitest'
import { CAPTIONS } from '../src/data/captions'
import { LANTERN_HOOK_CAPTION, LANTERN_HOOK_CAPTION_S } from '../src/data/lanternLight'
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
  // Task 3, H1 screen scare sting (the Off subtitles are silent caption events, 3 s each).
  'screen-scare-sting',
  // Task 4, H4 bats.
  'bat-chitter',
  // Task 7, H2 creature tells and attacks.
  'crawler-tell',
  'crawler-grab',
  'bride-tell',
  'bride-touch',
  'hound-tell',
  'hound-bite',
]
/** The ones heard from a world position. */
const SPEC_11_WORLD_SOUNDS: readonly SoundId[] = [
  'vending-coin',
  'vending-handle',
  'vending-tray',
  'vending-refuse',
  'bat-chitter',
  'crawler-tell',
  'crawler-grab',
  'bride-tell',
  'bride-touch',
  'hound-tell',
  'hound-bite',
]

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

  // Task 6, H7: the belt-hook caption is not a sound event; it is shown once per run by the hand
  // state machine, from its own constant, and has to meet the same 1.5 s floor.
  it('keeps the lantern hook caption on screen for at least 1.5 s', () => {
    expect(LANTERN_HOOK_CAPTION.trim()).toBe('Lantern hooked to your belt')
    expect(LANTERN_HOOK_CAPTION_S).toBeGreaterThanOrEqual(1.5)
  })
})
