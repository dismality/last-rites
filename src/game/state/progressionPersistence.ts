// The single list of persisted progression fields. Save and the Retry Night snapshot are both
// built from it, so a field cannot be saved but forgotten by Retry (Req 11.1, 11.13).
import type { ProgressionSave } from '../systems/progressionSave'
import { useProgressionStore, type ProgressionFields } from './progressionStore'
import { useLanternHandStore } from './lanternHandStore'
import { captureScreenScare, restoreScreenScare } from './screenScareStore'

export const PROGRESSION_PERSISTED = [
  'mode',
  'seed',
  'ranks',
  'pendingPick',
  'dawnSummary',
  'score',
  'bossScored',
  'coins',
  'contracts',
  'stock',
  'stats',
  'storm',
] as const satisfies readonly (keyof ProgressionFields)[]

/** A deep copy of every persisted field, so later store changes never alter a save. */
export function captureProgressionSave(): ProgressionSave {
  const s = useProgressionStore.getState()
  const picked = Object.fromEntries(PROGRESSION_PERSISTED.map((k) => [k, s[k]]))
  return {
    ...(structuredClone(picked) as unknown as ProgressionSave),
    screenScare: captureScreenScare(),
    lanternHookCaptionShown: useLanternHandStore.getState().hookCaptionShown,
  }
}

/** Puts a sanitised save back into the store. */
export function restoreProgressionSave(
  save: Omit<ProgressionSave, 'screenScare' | 'lanternHookCaptionShown'> &
    Partial<Pick<ProgressionSave, 'screenScare' | 'lanternHookCaptionShown'>>,
): void {
  const { screenScare, lanternHookCaptionShown, ...fields } = structuredClone(save)
  useProgressionStore.getState().patch(fields as unknown as Partial<ProgressionFields>)
  // Retry snapshots leave it out: a Retry never un-uses a moment or resets the cooldown.
  if (screenScare) restoreScreenScare(screenScare)
  // Same for the belt-hook caption flag: only a real save sets it.
  if (lanternHookCaptionShown !== undefined) {
    useLanternHandStore.getState().setHookCaptionShown(lanternHookCaptionShown)
  }
}

/** The Retry Night snapshot of progression: everything but the screen scare state, which Retry keeps. */
export function captureProgressionSnapshot(): Omit<
  ProgressionSave,
  'screenScare' | 'lanternHookCaptionShown'
> {
  const { screenScare, lanternHookCaptionShown, ...rest } = captureProgressionSave()
  void screenScare
  void lanternHookCaptionShown
  return rest
}
