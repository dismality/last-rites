// Compass maths (design bible §11). Pure TS.
// Yaw convention: yaw 0 looks down -Z (north), positive yaw turns left, so forward is
// (-sin yaw, -cos yaw) (movement.ts, forwardFromYaw). Compass degrees run clockwise
// from north (N = -Z, E = +X), hence heading = -yaw. mapDraw's quill rotates by -yaw too.
import { COMPASS, COMPASS_LETTERS, COMPASS_MARKERS } from '../../data/compass'
import { CHAPEL_CENTER } from '../../data/cemeteryLayout'
import { WAVE_GRAVES } from '../../data/waves'
import type { Phase } from '../types'
import { eligibleGraves } from './waves'

export interface CompassVec2 {
  x: number
  z: number
}

export type CompassLetter = 'N' | 'E' | 'S' | 'W'

export interface CompassTick {
  rel: number
  label?: CompassLetter
}

export interface CompassMarker {
  id: string
  glyph: string
  label: string
  /** Degrees from the heading, (-180, 180]. */
  rel: number
  /** Strip position, -1 (left edge) to 1 (right edge). */
  x: number
  pinned: 'left' | 'right' | null
  distanceM?: number
}

const RAD_TO_DEG = 180 / Math.PI

const mod360 = (deg: number): number => {
  const r = ((deg % 360) + 360) % 360
  // -1e-16 % 360 style underflow can land exactly on 360.
  return r >= 360 ? 0 : r
}

/** Compass heading in [0, 360): 0 = N (-Z), 90 = E (+X). */
export const headingDeg = (yaw: number): number => mod360(-yaw * RAD_TO_DEG)

/** Compass bearing from one ground point to another, [0, 360). */
export const bearingDeg = (from: CompassVec2, to: CompassVec2): number =>
  mod360(Math.atan2(to.x - from.x, -(to.z - from.z)) * RAD_TO_DEG)

/** Signed angle from the heading to the bearing, in (-180, 180]. */
export const relativeAngle = (bearing: number, heading: number): number => {
  const r = mod360(bearing - heading)
  return r > 180 ? r - 360 : r
}

/** Ticks every 15° that fall within the strip, left to right. */
export const compassTicks = (heading: number): CompassTick[] => {
  const ticks: CompassTick[] = []
  for (let a = 0; a < 360; a += COMPASS.tickStepDeg) {
    const rel = relativeAngle(a, heading)
    if (Math.abs(rel) > COMPASS.halfSpanDeg) continue
    const label = (COMPASS_LETTERS as Readonly<Record<number, CompassLetter>>)[a]
    ticks.push(label ? { rel, label } : { rel })
  }
  return ticks.sort((p, q) => p.rel - q.rel)
}

const makeMarker = (
  id: string,
  kind: keyof typeof COMPASS_MARKERS,
  rel: number,
  label: string = COMPASS_MARKERS[kind].label,
  distanceM?: number,
): CompassMarker => {
  const pinned = rel > COMPASS.halfSpanDeg ? 'right' : rel < -COMPASS.halfSpanDeg ? 'left' : null
  const x = Math.max(-1, Math.min(1, rel / COMPASS.halfSpanDeg))
  const marker: CompassMarker = { id, glyph: COMPASS_MARKERS[kind].glyph, label, rel, x, pinned }
  if (distanceM !== undefined) marker.distanceM = distanceM
  return marker
}

export interface CompassContext {
  player: CompassVec2
  heading: number
  objective?: readonly [number, number, number]
  phase: Phase
  bellBuilt: boolean
}

export const buildCompassMarkers = (c: CompassContext): CompassMarker[] => {
  const rel = (to: CompassVec2): number => relativeAngle(bearingDeg(c.player, to), c.heading)
  const markers: CompassMarker[] = []

  if (c.objective) {
    const target = { x: c.objective[0], z: c.objective[2] }
    const dist = Math.round(Math.hypot(target.x - c.player.x, target.z - c.player.z))
    markers.push(makeMarker('objective', 'objective', rel(target), `${dist} m`, dist))
  }
  markers.push(makeMarker('chapel', 'chapel', rel({ x: CHAPEL_CENTER[0], z: CHAPEL_CENTER[2] })))
  markers.push(makeMarker('hut', 'hut', rel({ x: 0, z: 0 })))

  if ((c.phase === 'dusk' || c.phase === 'night') && c.bellBuilt) {
    // One skull per 15° bucket of absolute bearing keeps the strip readable.
    const buckets = new Map<number, number>()
    for (const g of eligibleGraves(WAVE_GRAVES, c.player)) {
      const b = bearingDeg(c.player, g)
      const key = Math.floor(b / COMPASS.tickStepDeg)
      if (!buckets.has(key)) buckets.set(key, b)
    }
    for (const [key, b] of buckets) {
      markers.push(makeMarker(`spawn-${key}`, 'spawn', relativeAngle(b, c.heading)))
    }
  }
  return markers
}
