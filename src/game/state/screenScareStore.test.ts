import { beforeEach, describe, expect, it } from 'vitest'
import { sanitizeProgression } from '../systems/progressionSave'
import { initialScreenScareState } from '../systems/screenScares'
import { captureProgressionSave, restoreProgressionSave } from './progressionPersistence'
import { resetRun } from './resetRun'
import { progressionSnapshot } from './retryNight'
import { captureScreenScare, useScreenScareStore } from './screenScareStore'
import { simClock } from './simClock'
import { tickScreenScare, triggerScreenScare } from './screenScareActions'
import { useSettingsStore } from './settingsStore'

const ctx = { inventory: [] as never, takenPickups: [] as string[] }

function setUsed(): void {
  useScreenScareStore.getState().setScare({
    ...initialScreenScareState(),
    lastStartSim: 40,
    used: new Set(['coffin-night-2'] as const),
  })
}

describe('screen scare state in the progression save', () => {
  beforeEach(() => {
    resetRun()
    simClock.now = 100
  })

  it('is kept by Save and Continue', () => {
    setUsed()
    const save = captureProgressionSave()
    expect(save.screenScare).toEqual({ lastStartSim: 40, used: ['coffin-night-2'] })
    useScreenScareStore.getState().setScare(initialScreenScareState())
    restoreProgressionSave(sanitizeProgression(JSON.parse(JSON.stringify(save)), ctx))
    expect(captureScreenScare()).toEqual({ lastStartSim: 40, used: ['coffin-night-2'] })
  })

  it('is left alone by the Retry snapshot, so a Retry never un-uses a moment', () => {
    setUsed()
    const snap = progressionSnapshot.getState() as unknown as Record<string, unknown>
    expect('screenScare' in snap).toBe(false)
    useScreenScareStore.getState().setScare({ ...initialScreenScareState(), lastStartSim: 90, used: new Set(['ossuary-grille'] as const) })
    progressionSnapshot.setState(snap as never)
    expect(captureScreenScare()).toEqual({ lastStartSim: 90, used: ['ossuary-grille'] })
  })

  it('is cleared by New Game', () => {
    setUsed()
    resetRun()
    expect(captureScreenScare()).toEqual({ lastStartSim: null, used: [] })
  })

  it('pulls a saved start time from a later session back to now', () => {
    const save = sanitizeProgression({ screenScare: { lastStartSim: 5000, used: [] } }, ctx)
    restoreProgressionSave(save)
    expect(captureScreenScare().lastStartSim).toBe(100)
  })

  it('drops junk from a save', () => {
    const save = sanitizeProgression({ screenScare: { lastStartSim: -3, used: ['nope', 'ossuary-grille', 4] } }, ctx)
    expect(save.screenScare).toEqual({ lastStartSim: null, used: ['ossuary-grille'] })
    expect(sanitizeProgression({}, ctx).screenScare).toEqual({ lastStartSim: null, used: [] })
  })
})

describe('triggerScreenScare', () => {
  beforeEach(() => {
    resetRun()
    simClock.now = 500
    useSettingsStore.setState({ jumpscares: 'full' })
  })

  it('starts a scare, then refuses inside the cooldown, and clears when the timeline ends', () => {
    expect(triggerScreenScare('crawler')).toBe('started')
    expect(useScreenScareStore.getState().scare.active?.set).toBe('zombie-bottom')
    expect(triggerScreenScare('bride')).toBe('cooldown')
    simClock.now += 2
    tickScreenScare()
    expect(useScreenScareStore.getState().scare.active).toBeNull()
    simClock.now += 200
    expect(triggerScreenScare('bride')).toBe('started')
  })
})
