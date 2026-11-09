import { afterEach, describe, expect, it } from 'vitest'
import { CAPTIONS } from '../../data/captions'
import { SOUND_IDS } from '../../data/sounds'
import { subscribeToType } from '../events'
import { emitCombatSound, setCombatSoundListener, type CombatSoundId } from './combatSounds'

function collect(): { texts: string[]; stop: () => void } {
  const texts: string[] = []
  const stop = subscribeToType('subtitleShown', (e) => texts.push(e.text))
  return { texts, stop }
}

afterEach(() => setCombatSoundListener(null))

describe('emitCombatSound', () => {
  it('raises the caption for every captioned sound with no listener', () => {
    const events = new Set(CAPTIONS.map((c) => c.event))
    for (const id of events) {
      const { texts, stop } = collect()
      emitCombatSound(id)
      stop()
      const expected = CAPTIONS.find((c) => c.event === id)!
      expect(texts).toEqual([expected.text])
    }
  })

  it('picks the door caption for board-break when asked', () => {
    const { texts, stop } = collect()
    emitCombatSound('board-break', undefined, 'board-break-vestry')
    stop()
    expect(texts).toEqual(['[wood splinters at the vestry door]'])
  })

  it('raises no caption for a sound without one, but still calls the listener', () => {
    const captioned = new Set<string>(CAPTIONS.map((c) => c.event))
    const silent = SOUND_IDS.find((id) => !captioned.has(id))!
    const calls: CombatSoundId[] = []
    setCombatSoundListener((id) => calls.push(id))
    const { texts, stop } = collect()
    emitCombatSound(silent)
    stop()
    expect(texts).toEqual([])
    expect(calls).toEqual([silent])
  })

  it('passes the position to the listener', () => {
    let got: unknown
    setCombatSoundListener((_id, at) => (got = at))
    emitCombatSound('reload', { x: 1, y: 2, z: 3 })
    expect(got).toEqual({ x: 1, y: 2, z: 3 })
  })

  it('does nothing when no listener is registered', () => {
    expect(() => emitCombatSound('revolver-shot')).not.toThrow()
  })
})
