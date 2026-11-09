// Crosshair hit marker. One marker per attack, never one per pellet (Req 10.1, 10.2, 10.4).
import { HIT_MARKER } from '../../data/combatFeedback'

export interface AttackSummary {
  zombiesHit: number
  kills: number
  headshots: number
}

export interface HitMarkerState {
  ageS: number
  kind: 'hit' | 'kill'
  headshot: boolean
}

/** Replaces any previous marker so a rapid second attack restarts the flick instead of stacking. */
export function markAttack(_prev: HitMarkerState | null, s: AttackSummary): HitMarkerState | null {
  if (!(s.zombiesHit > 0)) return null
  return { ageS: 0, kind: s.kills > 0 ? 'kill' : 'hit', headshot: s.headshots > 0 }
}

/** With Flashing lights off the marker holds longer so it is a steady change, not a flick (Req 10.10). */
export function tickHitMarker(
  m: HitMarkerState | null,
  dt: number,
  flashing: boolean,
): HitMarkerState | null {
  if (!m) return null
  const ageS = m.ageS + Math.max(0, dt)
  const life = flashing ? HIT_MARKER.hitS : HIT_MARKER.steadyS
  return ageS >= life ? null : { ...m, ageS }
}

/** The headshot dot and ring are shapes, so the cue never relies on colour (Req 10.2). */
export const markerShape = (m: HitMarkerState): { dot: boolean; ring: boolean; scale: number } => ({
  dot: m.headshot,
  ring: m.headshot,
  scale: m.kind === 'kill' ? HIT_MARKER.killScale : 1,
})
