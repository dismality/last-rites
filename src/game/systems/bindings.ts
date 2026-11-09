/** Pure rebinding rule: one key per action, Escape stays reserved for pause. */

export type BindingMap = Readonly<Record<string, string>>

export type RebindResult =
  | { ok: true; bindings: Record<string, string> }
  | { ok: false; reason: 'conflict'; conflictingAction: string; bindings: Record<string, string> }
  | { ok: false; reason: 'reserved'; bindings: Record<string, string> }

/** Keys that can never be assigned, so the player can always pause. */
export const RESERVED_KEYS: readonly string[] = ['Escape']

/**
 * Try to bind `key` to `action`. On any rejection the returned bindings are an
 * unchanged copy, so callers can keep both existing bindings (Req 21.9).
 */
export function rebind(bindings: BindingMap, action: string, key: string): RebindResult {
  const unchanged = { ...bindings }
  if (RESERVED_KEYS.includes(key)) {
    return { ok: false, reason: 'reserved', bindings: unchanged }
  }
  for (const [other, bound] of Object.entries(bindings)) {
    if (other !== action && bound === key) {
      return { ok: false, reason: 'conflict', conflictingAction: other, bindings: unchanged }
    }
  }
  return { ok: true, bindings: { ...bindings, [action]: key } }
}
