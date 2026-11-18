// The single list of persisted progression fields. Save and the Retry Night snapshot are both
// built from it, so a field cannot be saved but forgotten by Retry (Req 11.1, 11.13).
import type { ProgressionSave } from '../systems/progressionSave'
import { useProgressionStore, type ProgressionFields } from './progressionStore'
import { useLanternHandStore } from './lanternHandStore'
import { captureCreaturesSeen, restoreCreaturesSeen } from './creatureStore'
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

/** Fields saved with the progression block but held in their own stores, and so left out of Retry snapshots. */
type KeptByRetry = 'screenScare' | 'lanternHookCaptionShown' | 'creaturesSeen'

/** A deep copy of every persisted field, so later store changes never alter a save. */
export function captureProgressionSave(): ProgressionSave {
  const s = useProgressionStore.getState()
  const picked = Object.fromEntries(PROGRESSION_PERSISTED.map((k) => [k, s[k]]))
  return {
    ...(structuredClone(picked) as unknown as ProgressionSave),
    screenScare: captureScreenScare(),
    lanternHookCaptionShown: useLanternHandStore.getState().hookCaptionShown,
    creaturesSeen: captureCreaturesSeen(),
  }
}

/** Puts a sanitised save back into the store. */
export function restoreProgressionSave(
  save: Omit<ProgressionSave, KeptByRetry> & Partial<Pick<ProgressionSave, KeptByRetry>>,
): void {
  const { screenScare, lanternHookCaptionShown, creaturesSeen, ...fields } = structuredClone(save)
  useProgressionStore.getState().patch(fields as unknown as Partial<ProgressionFields>)
  // Retry snapshots leave it out: a Retry never un-uses a moment or resets the cooldown.
  if (screenScare) restoreScreenScare(screenScare)
  // Same for the belt-hook caption flag: only a real save sets it.
  if (lanternHookCaptionShown !== undefined) {
    useLanternHandStore.getState().setHookCaptionShown(lanternHookCaptionShown)
  }
  // And for the Bestiary: a Retry never makes the player forget a creature.
  if (creaturesSeen !== undefined) restoreCreaturesSeen(creaturesSeen)
}

/** The Retry Night snapshot of progression: everything but the fields held in their own stores, which Retry keeps. */
export function captureProgressionSnapshot(): Omit<ProgressionSave, KeptByRetry> {
  const { screenScare, lanternHookCaptionShown, creaturesSeen, ...rest } = captureProgressionSave()
  void screenScare
  void lanternHookCaptionShown
  void creaturesSeen
  return rest
}
