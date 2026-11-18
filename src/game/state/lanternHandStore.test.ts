import { beforeEach, describe, expect, it } from 'vitest'
import { sanitizeProgression } from '../systems/progressionSave'
import { useLanternHandStore } from './lanternHandStore'
import { captureProgressionSave, restoreProgressionSave } from './progressionPersistence'
import { resetRun } from './resetRun'
import { progressionSnapshot } from './retryNight'

const ctx = { inventory: [] as never, takenPickups: [] as string[] }
const shown = (): boolean => useLanternHandStore.getState().hookCaptionShown

describe('belt-hook caption flag in the progression save', () => {
  beforeEach(() => resetRun())

  it('is kept by Save and Continue', () => {
    useLanternHandStore.getState().setHookCaptionShown(true)
    const save = captureProgressionSave()
    expect(save.lanternHookCaptionShown).toBe(true)
    useLanternHandStore.getState().setHookCaptionShown(false)
    restoreProgressionSave(sanitizeProgression(JSON.parse(JSON.stringify(save)), ctx))
    expect(shown()).toBe(true)
  })

  it('is kept by Retry Night and Retry from morning (the snapshot omits it)', () => {
    const snap = progressionSnapshot.getState() as unknown as Record<string, unknown>
    expect('lanternHookCaptionShown' in snap).toBe(false)
    useLanternHandStore.getState().setHookCaptionShown(true)
    progressionSnapshot.setState(snap as never)
    expect(shown()).toBe(true)
  })

  it('is cleared by New Game and defaults to false for junk', () => {
    useLanternHandStore.getState().setHookCaptionShown(true)
    resetRun()
    expect(shown()).toBe(false)
    expect(
      sanitizeProgression({ lanternHookCaptionShown: 'yes' }, ctx).lanternHookCaptionShown,
    ).toBe(false)
  })
})
