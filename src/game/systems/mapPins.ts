// Map pin rules (design bible §11, "Big map and pins"). Pure TS: no React / three.js.
// A pin is a player-placed waypoint. At most PIN_LIMIT exist; the list is ordered oldest first,
// and each pin keeps a number 1..3 so its glyph and shape stay the same while it lives.

import { PLAYABLE_BOUNDS } from '../../data/cemeteryLayout'

export const PIN_LIMIT = 3
/** Walking this close to a pin clears it (m). */
export const PIN_REACH_M = 2
/** A click this close to a pin or landmark (screen pixels) counts as a hit on it. */
export const PIN_HIT_PX = 16

export type PinSlot = 1 | 2 | 3
export const PIN_SLOTS: readonly PinSlot[] = [1, 2, 3]

/** Shape per number, so a pin is never told apart by colour alone. */
export const PIN_SHAPES: Readonly<Record<PinSlot, 'circle' | 'square' | 'triangle'>> = {
  1: 'circle',
  2: 'square',
  3: 'triangle',
}

/** Circled digits for the compass and legend text. */
export const PIN_GLYPHS: Readonly<Record<PinSlot, string>> = { 1: '①', 2: '②', 3: '③' }

export interface Pin {
  slot: PinSlot
  x: number
  z: number
  /** "Pin 2", or the landmark the player clicked. */
  name: string
}

export interface PinTarget {
  x: number
  z: number
  name?: string
}

const isSlot = (v: unknown): v is PinSlot => v === 1 || v === 2 || v === 3

/** Nearest point inside the playable area; NaN becomes the origin. */
export function clampToBounds(x: number, z: number): [number, number] {
  const c = (v: number, half: number) => (Number.isFinite(v) ? Math.min(half, Math.max(-half, v)) : 0)
  return [c(x, PLAYABLE_BOUNDS.halfX), c(z, PLAYABLE_BOUNDS.halfZ)]
}

export const defaultPinName = (slot: PinSlot): string => `Pin ${slot}`

/**
 * Adds a pin. With a free number it takes the lowest; with all three in use it replaces the
 * oldest and inherits its number. The point is clamped into the playable bounds.
 */
export function addPin(pins: readonly Pin[], target: PinTarget): Pin[] {
  const [x, z] = clampToBounds(target.x, target.z)
  const used = new Set(pins.map((p) => p.slot))
  const free = PIN_SLOTS.find((s) => !used.has(s))
  let rest = [...pins]
  let slot: PinSlot
  if (free !== undefined && pins.length < PIN_LIMIT) {
    slot = free
  } else {
    slot = rest[0].slot
    rest = rest.slice(1)
  }
  return [...rest, { slot, x, z, name: target.name ?? defaultPinName(slot) }]
}

export function removePin(pins: readonly Pin[], slot: PinSlot): Pin[] {
  return pins.filter((p) => p.slot !== slot)
}

export const pinBySlot = (pins: readonly Pin[], slot: PinSlot): Pin | undefined =>
  pins.find((p) => p.slot === slot)

export const pinDistance = (pin: Pin, player: { x: number; z: number }): number =>
  Math.hypot(pin.x - player.x, pin.z - player.z)

/** Splits the pins into the ones still standing and the ones the player has walked up to. */
export function reachPins(
  pins: readonly Pin[],
  player: { x: number; z: number },
  reachM: number = PIN_REACH_M,
): { pins: Pin[]; reached: Pin[] } {
  const kept: Pin[] = []
  const reached: Pin[] = []
  for (const p of pins) (pinDistance(p, player) <= reachM ? reached : kept).push(p)
  return { pins: kept, reached }
}

/** The in-world beacon is gone by the time the pin clears, and fully there from this far out (m). */
export const BEACON_FADE_START_M = 4

/** Beacon opacity factor 0..1: 1 beyond 4 m, falling linearly to 0 at the reach distance. */
export function beaconFade(distanceM: number): number {
  if (!Number.isFinite(distanceM)) return 1
  const t = (distanceM - PIN_REACH_M) / (BEACON_FADE_START_M - PIN_REACH_M)
  return Math.min(1, Math.max(0, t))
}

/** Plain JSON for the save file and the retry snapshots. */
export function serializePins(pins: readonly Pin[]): Pin[] {
  return pins.map((p) => ({ slot: p.slot, x: p.x, z: p.z, name: p.name }))
}

/** Rebuilds pins from untrusted data: bad entries are dropped, duplicates and extras ignored. */
export function restorePins(raw: unknown): Pin[] {
  if (!Array.isArray(raw)) return []
  const out: Pin[] = []
  const seen = new Set<PinSlot>()
  for (const e of raw) {
    if (typeof e !== 'object' || e === null) continue
    const r = e as Record<string, unknown>
    if (!isSlot(r.slot) || seen.has(r.slot)) continue
    if (typeof r.x !== 'number' || typeof r.z !== 'number' || !Number.isFinite(r.x) || !Number.isFinite(r.z)) continue
    const [x, z] = clampToBounds(r.x, r.z)
    const name = typeof r.name === 'string' && r.name.length > 0 ? r.name.slice(0, 60) : defaultPinName(r.slot)
    seen.add(r.slot)
    out.push({ slot: r.slot, x, z, name })
    if (out.length >= PIN_LIMIT) break
  }
  return out
}

/** The nearest item within `radius` of a point (same units as the radius), or undefined. */
export function nearestWithin<T>(
  items: readonly T[],
  at: (item: T) => readonly [number, number],
  x: number,
  y: number,
  radius: number,
): T | undefined {
  let best: T | undefined
  let bestD = radius
  for (const item of items) {
    const [ix, iy] = at(item)
    const d = Math.hypot(ix - x, iy - y)
    if (d <= bestD) {
      best = item
      bestD = d
    }
  }
  return best
}
