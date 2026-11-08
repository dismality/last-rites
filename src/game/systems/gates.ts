// Gate use rules: what happens when the player interacts with a locked gate.
// Pure; the scene calls this and applies the result.

import { GATE_DEFS, type GateUseSite } from '../../data/gateHints'
import type { KeyItemId } from '../types'
import { MYSTERY_GATE_KEYS, openGate, type MysteryGateId, type MysteryState } from './mystery'

export type GateUseResult =
  | { kind: 'opened'; state: MysteryState; text: string; sound: string }
  | { kind: 'already-open'; state: MysteryState }
  | { kind: 'hint'; state: MysteryState; text: string }

export function isGateOpen(state: MysteryState, gate: MysteryGateId): boolean {
  return state.gates[gate]
}

/**
 * Tries to open `gate` from `site`. Without the key (or at the wrong site) the state
 * is unchanged and a hint toward the key is returned instead.
 */
export function tryOpenGate(
  state: MysteryState,
  gate: MysteryGateId,
  site: GateUseSite,
  inventory: { readonly keyItems: readonly KeyItemId[] },
): GateUseResult {
  const def = GATE_DEFS[gate]
  if (state.gates[gate]) return { kind: 'already-open', state }
  if (def.site !== site) {
    const hasKey = inventory.keyItems.includes(MYSTERY_GATE_KEYS[gate])
    return { kind: 'hint', state, text: (hasKey && def.hintWrongSite) || def.hintMissingKey }
  }
  const next = openGate(state, gate, inventory)
  if (next === state) return { kind: 'hint', state, text: def.hintMissingKey }
  return { kind: 'opened', state: next, text: def.unlockText, sound: def.unlockSound }
}
