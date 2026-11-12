// Minimap view window: world metres <-> minimap pixels, north up, centred on the player.
// Pure (no React / three.js). World axes are +X east, +Z south, so north is screen-up.

import { MAP_CELL_SIZE } from '../../data/mapLandmarks'

export interface MinimapGeometry {
  /** Side of the square canvas in pixels. */
  sizePx: number
  /** Metres from the player to each edge of the window. */
  radiusM: number
}

export interface Point2 {
  x: number
  z: number
}

export const pxPerMetre = (g: MinimapGeometry): number => g.sizePx / 2 / g.radiusM

/** World (x, z) to canvas pixels; the player is always at the centre. Not clamped. */
export function worldToMinimap(g: MinimapGeometry, player: Point2, x: number, z: number): [number, number] {
  const s = pxPerMetre(g)
  const c = g.sizePx / 2
  return [c + (x - player.x) * s, c + (z - player.z) * s]
}

/** Canvas pixels back to world metres (x, z); inverse of worldToMinimap. */
export function minimapToWorld(g: MinimapGeometry, player: Point2, px: number, py: number): [number, number] {
  const s = pxPerMetre(g)
  const c = g.sizePx / 2
  return [player.x + (px - c) / s, player.z + (py - c) / s]
}

export interface PlacedMarker {
  /** Canvas pixels; for a pinned marker this lies on the inset border. */
  x: number
  y: number
  /** True when the target is outside the window and has been moved onto the border. */
  pinned: boolean
  /** Direction to the target in radians, clockwise from north (screen-up). */
  angle: number
  /** Straight-line distance to the target in metres. */
  distanceM: number
}

/**
 * Where a world target is drawn. Inside the window it keeps its place; outside it is pulled along
 * the line from the centre to the target onto the border (inset by `insetPx`), so the direction
 * is exact. `angle` points at the target in both cases, which is what the pinned arrow shows.
 */
export function placeMarker(g: MinimapGeometry, player: Point2, target: Point2, insetPx: number): PlacedMarker {
  const s = pxPerMetre(g)
  const dx = (target.x - player.x) * s
  const dz = (target.z - player.z) * s
  const half = Math.max(0, g.sizePx / 2 - insetPx)
  const reach = Math.max(Math.abs(dx), Math.abs(dz))
  const angle = dx === 0 && dz === 0 ? 0 : Math.atan2(dx, -dz)
  const distanceM = Math.hypot(target.x - player.x, target.z - player.z)
  const c = g.sizePx / 2
  if (reach <= half) return { x: c + dx, y: c + dz, pinned: false, angle, distanceM }
  const t = half / reach
  return { x: c + dx * t, y: c + dz * t, pinned: true, angle, distanceM }
}

export interface CellRange {
  minCx: number
  maxCx: number
  minCz: number
  maxCz: number
}

/** Inclusive range of 8 m map cells that touch the window, so only those are looked up and drawn. */
export function visibleCellRange(radiusM: number, player: Point2): CellRange {
  return {
    minCx: Math.floor((player.x - radiusM) / MAP_CELL_SIZE),
    maxCx: Math.floor((player.x + radiusM) / MAP_CELL_SIZE),
    minCz: Math.floor((player.z - radiusM) / MAP_CELL_SIZE),
    maxCz: Math.floor((player.z + radiusM) / MAP_CELL_SIZE),
  }
}

const BEARINGS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'] as const

/** Eight-way word for a clockwise-from-north angle in radians, for the screen-reader label. */
export function bearingWord(angle: number): (typeof BEARINGS)[number] {
  const turn = ((angle / (2 * Math.PI)) % 1 + 1) % 1
  return BEARINGS[Math.round(turn * 8) % 8]
}
