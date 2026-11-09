// World <-> journal-map pixel transform. Pure; the canvas drawing (mapDraw.toPx) calls worldToMap
// so the drawn sheet and the quill/objective markers always share one projection.

import { MAP_CELL_SIZE, MAP_EXTENT, MAP_PX } from '../../data/mapLandmarks'

const COLS = MAP_EXTENT.maxCx - MAP_EXTENT.minCx + 1
const ROWS = MAP_EXTENT.maxCz - MAP_EXTENT.minCz + 1

/** Canvas size in pixels (cells plus a margin on every side). */
export const MAP_CANVAS_WIDTH = COLS * MAP_PX.cellPx + MAP_PX.marginPx * 2
export const MAP_CANVAS_HEIGHT = ROWS * MAP_PX.cellPx + MAP_PX.marginPx * 2

/** World metres (x, z) to canvas pixels. Not clamped. */
export const worldToMap = (x: number, z: number): [number, number] => [
  MAP_PX.marginPx + (x / MAP_CELL_SIZE - MAP_EXTENT.minCx) * MAP_PX.cellPx,
  MAP_PX.marginPx + (z / MAP_CELL_SIZE - MAP_EXTENT.minCz) * MAP_PX.cellPx,
]

/** Canvas pixels back to world metres (x, z); inverse of worldToMap. */
export const mapToWorld = (px: number, py: number): [number, number] => [
  ((px - MAP_PX.marginPx) / MAP_PX.cellPx + MAP_EXTENT.minCx) * MAP_CELL_SIZE,
  ((py - MAP_PX.marginPx) / MAP_PX.cellPx + MAP_EXTENT.minCz) * MAP_CELL_SIZE,
]

const clamp = (v: number, max: number): number => (Number.isNaN(v) ? 0 : Math.min(max, Math.max(0, v)))

/** Nearest point on the canvas to a pixel position; any input yields a point inside the canvas. */
export const clampToMap = (px: number, py: number): [number, number] => [
  clamp(px, MAP_CANVAS_WIDTH),
  clamp(py, MAP_CANVAS_HEIGHT),
]
