// Big map view: zoom and pan over the Journal map sheet. Pure TS.
// The screen transform is `screen = offset + k * sheetPx`, and the sheet is drawn by the same
// mapDraw code as the Journal (sheet px = worldToMap). Click-to-world is the exact inverse of
// that chain, so a click always lands on the point that was drawn under the cursor.

import { MAP_CELL_SIZE, MAP_PX } from '../../data/mapLandmarks'
import { MAP_CANVAS_HEIGHT, MAP_CANVAS_WIDTH, mapToWorld, worldToMap } from './mapProject'

export interface BigMapView {
  /** Screen pixels per sheet pixel. */
  k: number
  /** Screen position of the sheet's top-left corner. */
  ox: number
  oy: number
}

export interface Viewport {
  width: number
  height: number
}

/** Narrowest view: this many metres across the shorter side of the screen. */
export const BIG_MAP_MIN_SPAN_M = 30

const SHEET_PX_PER_M = MAP_PX.cellPx / MAP_CELL_SIZE

/** k at which the whole sheet fits the screen. */
export const fitScale = (v: Viewport): number =>
  Math.min(v.width / MAP_CANVAS_WIDTH, v.height / MAP_CANVAS_HEIGHT)

/** k at which the shorter screen side spans about BIG_MAP_MIN_SPAN_M metres. */
export const maxScale = (v: Viewport): number =>
  Math.max(fitScale(v), Math.min(v.width, v.height) / BIG_MAP_MIN_SPAN_M / SHEET_PX_PER_M)

/** Keeps the sheet covering the screen, or centred on an axis where it is smaller than it. */
export function clampView(view: BigMapView, v: Viewport): BigMapView {
  const k = Math.min(maxScale(v), Math.max(fitScale(v), view.k))
  const axis = (o: number, sheet: number, screen: number): number => {
    const size = sheet * k
    if (size <= screen) return (screen - size) / 2
    return Math.min(0, Math.max(screen - size, o))
  }
  return { k, ox: axis(view.ox, MAP_CANVAS_WIDTH, v.width), oy: axis(view.oy, MAP_CANVAS_HEIGHT, v.height) }
}

export const fitView = (v: Viewport): BigMapView => clampView({ k: fitScale(v), ox: 0, oy: 0 }, v)

/** World metres to screen pixels. */
export function worldToScreen(view: BigMapView, x: number, z: number): [number, number] {
  const [sx, sy] = worldToMap(x, z)
  return [view.ox + view.k * sx, view.oy + view.k * sy]
}

/** Screen pixels back to world metres; the exact inverse of worldToScreen. */
export function screenToWorld(view: BigMapView, px: number, py: number): [number, number] {
  return mapToWorld((px - view.ox) / view.k, (py - view.oy) / view.k)
}

/** Zoom by `factor`, keeping the world point under the screen position (px, py) where it is. */
export function zoomAt(view: BigMapView, v: Viewport, px: number, py: number, factor: number): BigMapView {
  const k = Math.min(maxScale(v), Math.max(fitScale(v), view.k * factor))
  const ratio = k / view.k
  return clampView({ k, ox: px - (px - view.ox) * ratio, oy: py - (py - view.oy) * ratio }, v)
}

export const panBy = (view: BigMapView, v: Viewport, dx: number, dy: number): BigMapView =>
  clampView({ ...view, ox: view.ox + dx, oy: view.oy + dy }, v)

/** Pans so a world point sits at the middle of the screen (as far as the clamp allows). */
export function centerOn(view: BigMapView, v: Viewport, x: number, z: number): BigMapView {
  const [sx, sy] = worldToMap(x, z)
  return clampView({ ...view, ox: v.width / 2 - view.k * sx, oy: v.height / 2 - view.k * sy }, v)
}

/** Metres across the shorter screen side, for the "about 30 m" end of the zoom range. */
export const spanMetres = (view: BigMapView, v: Viewport): number =>
  Math.min(v.width, v.height) / view.k / SHEET_PX_PER_M
