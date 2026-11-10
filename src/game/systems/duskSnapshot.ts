// Pure helpers for the snapshots used by Retry Night and Retry from morning. No React / three.js.
// Storage is injected so tests run in Node and failures can be simulated.

import { DUSK_SNAPSHOT_KEY } from '../../data/balance'

/** Store name -> plain data fields of that store. */
export type SnapshotData = Record<string, Record<string, unknown>>

/**
 * Keep only JSON-safe data fields: functions (actions) and Sets (transient
 * highlights) are dropped so a restore never overwrites store actions.
 */
export function pickData(state: object, omit: readonly string[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(state)) {
    if (typeof value === 'function' || value instanceof Set || omit.includes(key)) continue
    out[key] = value
  }
  return out
}

/** Returns false when storage is missing or throws (private mode, quota). */
export function saveSnapshot(
  storage: Pick<Storage, 'setItem'> | undefined,
  data: SnapshotData,
  key: string = DUSK_SNAPSHOT_KEY,
): boolean {
  try {
    if (!storage) return false
    storage.setItem(key, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}

/** Returns null when nothing usable is stored. */
export function loadSnapshot(
  storage: Pick<Storage, 'getItem'> | undefined,
  key: string = DUSK_SNAPSHOT_KEY,
): SnapshotData | null {
  try {
    const raw = storage?.getItem(key)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
    return parsed as SnapshotData
  } catch {
    return null
  }
}

/** Forgets a snapshot, so a stale one from an earlier run is never restored. */
export function clearSnapshot(storage: Pick<Storage, 'removeItem'> | undefined, key: string): void {
  try {
    storage?.removeItem(key)
  } catch {
    // Storage unavailable: nothing was stored either.
  }
}
