import { afterEach, describe, expect, it } from 'vitest'
import { subscribeToType } from '../game/events'
import { emitCombatSound } from '../game/state/combatSounds'
import { registerCombatSounds } from './audioBoot'
import type { SynthEngine } from './synth'
import { resetSynthForTests, setSynthForTests } from './synth'

afterEach(() => resetSynthForTests())

describe('registerCombatSounds', () => {
  it('delivers an emitted combat sound to the audio layer', () => {
    const played: string[] = []
    setSynthForTests({
      play: (id: string) => {
        played.push(id)
        return true
      },
    } as unknown as SynthEngine)
    const unregister = registerCombatSounds()
    emitCombatSound('revolver-shot')
    unregister()
    expect(played).toEqual(['revolver-shot'])
  })

  it('still shows the caption once the listener is removed', () => {
    const texts: string[] = []
    const stop = subscribeToType('subtitleShown', (e) => texts.push(e.text))
    registerCombatSounds()()
    emitCombatSound('revolver-shot')
    stop()
    expect(texts.length).toBe(1)
  })
})
