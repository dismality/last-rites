// The single list of persisted progression fields. Save and the Retry Night snapshot are both
// built from it, so a field cannot be saved but forgotten by Retry (Req 11.1, 11.13).
import type { ProgressionSave } from '../systems/progressionSave'
import { useProgressionStore, type ProgressionFields } from './progressionStore'

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
  return structuredClone(picked) as unknown as ProgressionSave
}

/** Puts a sanitised save back into the store. */
export function restoreProgressionSave(save: ProgressionSave): void {
  useProgressionStore.getState().patch(structuredClone(save) as unknown as Partial<ProgressionFields>)
}
