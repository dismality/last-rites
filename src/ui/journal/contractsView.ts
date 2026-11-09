// Pure view-model for the Contracts tab (no DOM test env, so the logic lives here).
import { CONTRACTS } from '../../data/contracts'
import type { DealtContract } from '../../game/systems/contracts'

export interface ContractEntry {
  id: string
  name: string
  text: string
  /** "n/goal", with n capped at the goal. */
  progressLabel: string
  rewardLabel: string
  done: boolean
  /** Shown only when done; a tag with text so it is not colour alone. */
  doneTag: string | null
}

/** Empty slots and unknown ids produce no entry. */
export function contractEntries(dealt: readonly (DealtContract | null | undefined)[]): ContractEntry[] {
  const out: ContractEntry[] = []
  for (const d of dealt) {
    if (!d) continue
    const def = CONTRACTS.find((c) => c.id === d.id)
    if (!def) continue
    const n = d.done ? def.goal : Math.max(0, Math.min(def.goal, Math.floor(d.progress)))
    out.push({
      id: def.id,
      name: def.name,
      text: def.text,
      progressLabel: `${n}/${def.goal}`,
      rewardLabel: `◎ ${def.reward}`,
      done: d.done,
      doneTag: d.done ? 'Done ✓' : null,
    })
  }
  return out
}
