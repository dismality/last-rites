import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SynthEngine } from './synth'
import { resetSynthForTests, setSynthForTests } from './synth'
import {
  playCombatSound,
  playEnemyCue,
  resetEnemyLoopsForTests,
  setListener,
  setLoopClockForTests,
  syncEnemyLoops,
} from './AudioManager'

let played: string[]
let now: number

beforeEach(() => {
  played = []
  now = 0
  setLoopClockForTests(() => now)
  setSynthForTests({
    play: (id: string) => {
      played.push(id)
      return true
    },
  } as unknown as SynthEngine)
})

afterEach(() => {
  resetSynthForTests()
  resetEnemyLoopsForTests()
  setLoopClockForTests(null)
})

const brute = { uid: 'b1', cue: 'brute-step' as const, x: 1, y: 1, z: 1 }

describe('syncEnemyLoops', () => {
  it('repeats a brute step every 0.9 s', () => {
    syncEnemyLoops([brute])
    now = 0.5
    syncEnemyLoops([brute])
    now = 0.9
    syncEnemyLoops([brute])
    expect(played).toEqual(['brute-step', 'brute-step'])
  })

  it('stops when the enemy is gone and restarts if it returns', () => {
    syncEnemyLoops([brute])
    syncEnemyLoops([])
    now = 5
    syncEnemyLoops([])
    expect(played).toHaveLength(1)
    now = 5.1
    syncEnemyLoops([brute])
    expect(played).toHaveLength(2)
  })

  it('ignores cues without a loop', () => {
    syncEnemyLoops([{ uid: 'w', cue: 'wailer-wail', x: 0, y: 0, z: 0 }])
    expect(played).toEqual([])
  })
})

describe('without an AudioContext', () => {
  it('does nothing and does not throw', () => {
    resetSynthForTests()
    expect(() => {
      setListener([0, 1, 0], 1)
      syncEnemyLoops([brute])
      playEnemyCue('brute-grunt', 0, 0, 0)
      playCombatSound('kick')
    }).not.toThrow()
    expect(played).toEqual([])
  })
})
