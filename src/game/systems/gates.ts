// Gate lock rules: a cemetery gate stays solid until its key item is held.

import { GATE_KEYS, type GateId } from '../../data/cemeteryLayout'
import type { KeyItemId } from '../types'

export function isGateLocked(gate: GateId, keyItems: readonly KeyItemId[]): boolean {
  return !keyItems.includes(GATE_KEYS[gate])
}
