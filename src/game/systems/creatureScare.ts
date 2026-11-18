// When a creature's gameplay effect lands relative to its screen scare (spec 11, Req 1.6, 1.7, 1.9).
// A crawler's grab waits for the out phase to start; a bride's oil drain waits for the in phase to
// end. If the scare never starts (cooldown, held and expired, dropped) the effect lands at once, so
// gameplay is the same at every Jumpscares value. Pure TypeScript: no React, three.js or Howler.

import { deferredReleaseMs, type ActiveScare, type DeferredRelease, type ScareKind } from './screenScares'

export type DeferredKind = Extract<ScareKind, 'crawler' | 'bride'>

/** Which moment of the scare releases each creature's effect. */
export const RELEASE_FOR: Readonly<Record<DeferredKind, DeferredRelease>> = {
  crawler: 'afterOutStart',
  bride: 'afterInEnd',
}

/**
 * `wait` while the matching scare is queued or still before its release time; `apply` otherwise
 * (no scare is coming, or the release time has passed).
 */
export function resolveDeferred(
  kind: DeferredKind,
  active: ActiveScare | null,
  queued: boolean,
  now: number,
): 'wait' | 'apply' {
  if (active !== null && active.kind === kind) {
    const releaseS = active.startSim + deferredReleaseMs(active.timeline, RELEASE_FOR[kind]) / 1000
    return now >= releaseS ? 'apply' : 'wait'
  }
  return queued ? 'wait' : 'apply'
}
