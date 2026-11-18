// Screen jumpscare state (spec 11 H1): the live scare, the cooldown clock and the scripted
// moments already used. The cooldown and the used set are saved in the progression save
// (progressionPersistence.ts); the active scare is never saved. Rules are in
// systems/screenScares.ts, the trigger in screenScareActions.ts.
import { create } from 'zustand'
import {
  initialScreenScareState,
  type ScreenScareState,
} from '../systems/screenScares'
import type { ScreenScareSave } from '../systems/progressionSave'
import { SCRIPTED_MOMENTS } from '../../data/screenScares'
import { simClock } from './simClock'

interface ScreenScareStore {
  scare: ScreenScareState
  setScare: (scare: ScreenScareState) => void
}

export const useScreenScareStore = create<ScreenScareStore>((set) => ({
  scare: initialScreenScareState(),
  setScare: (scare) => set({ scare }),
}))

/**
 * Per-frame values the post-processing stack reads. A plain object, because it changes every
 * frame and only the scene reads it (the same pattern as stormRuntime).
 */
export const screenScareRuntime = {
  /** World brightness multiplier: 1 normally, 0.3 during the hold of a Full scare. */
  brightness: 1,
}

export function resetScreenScareRuntime(): void {
  screenScareRuntime.brightness = 1
}

/** What the progression save keeps of the scare state. */
export function captureScreenScare(): ScreenScareSave {
  const { lastStartSim, used } = useScreenScareStore.getState().scare
  return { lastStartSim, used: [...used] }
}

/**
 * Puts a saved cooldown and used set back. The sim clock restarts at 0 with the page, so a saved
 * start time later than "now" is pulled back to now: the player waits at most one cooldown.
 */
export function restoreScreenScare(save: ScreenScareSave): void {
  const known = new Set(SCRIPTED_MOMENTS.map((m) => m.id))
  const used = new Set(save.used.filter((id) => known.has(id as never)))
  const base = initialScreenScareState()
  useScreenScareStore.getState().setScare({
    ...base,
    lastStartSim: save.lastStartSim === null ? null : Math.min(save.lastStartSim, simClock.now),
    used: used as ScreenScareState['used'],
  })
  resetScreenScareRuntime()
}
