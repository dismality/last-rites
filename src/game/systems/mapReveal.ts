// Self-drawing map: pure reveal logic on an 8 m grid (Requirement 6.1, 6.4).
// No React / three.js imports; world axes are +X east, +Z south.

import { MAP_CELL_SIZE, type Landmark } from '../../data/mapLandmarks'

export interface Cell {
  cx: number
  cz: number
}

/** Explored cells keyed by `cellKey`. A plain record so it serialises as-is. */
export interface MapState {
  explored: Readonly<Record<string, true>>
}

export const EMPTY_MAP: MapState = { explored: {} }

export function cellKey(cx: number, cz: number): string {
  return `${cx},${cz}`
}

/** Grid cell containing a world position (x, z). `+ 0` folds -0 into 0. */
export function cellAt(x: number, z: number): Cell {
  return { cx: Math.floor(x / MAP_CELL_SIZE) + 0, cz: Math.floor(z / MAP_CELL_SIZE) + 0 }
}

export function isExplored(map: MapState, cx: number, cz: number): boolean {
  return map.explored[cellKey(cx, cz)] === true
}

/**
 * Mark the cell under `position` as explored.
 * Returns the same map object when nothing changed, so repeated calls are
 * free and idempotent.
 */
export function revealAt(
  map: MapState,
  position: readonly [number, number, number],
): { map: MapState; newlyRevealed: Cell[] } {
  const [x, , z] = position
  if (!Number.isFinite(x) || !Number.isFinite(z)) return { map, newlyRevealed: [] }
  const cell = cellAt(x, z)
  if (isExplored(map, cell.cx, cell.cz)) return { map, newlyRevealed: [] }
  return {
    map: { explored: { ...map.explored, [cellKey(cell.cx, cell.cz)]: true } },
    newlyRevealed: [cell],
  }
}

/** Landmarks whose cell has been explored (Requirement 6.3). */
export function discoveredLandmarks(map: MapState, landmarks: readonly Landmark[]): Landmark[] {
  return landmarks.filter((l) => {
    const c = cellAt(l.position[0], l.position[2])
    return isExplored(map, c.cx, c.cz)
  })
}

/** Cells in a stable order (row by row), for drawing and saving. */
export function exploredCells(map: MapState): Cell[] {
  return Object.keys(map.explored)
    .map(parseKey)
    .filter((c): c is Cell => c !== null)
    .sort((a, b) => a.cz - b.cz || a.cx - b.cx)
}

function parseKey(key: string): Cell | null {
  const m = /^(-?\d+),(-?\d+)$/.exec(key)
  return m ? { cx: Number(m[1]), cz: Number(m[2]) } : null
}

// --- Save data (Requirement 6.4) --------------------------------------------

export interface MapSaveData {
  version: 1
  cells: Array<[number, number]>
}

export function serializeMap(map: MapState): MapSaveData {
  return { version: 1, cells: exploredCells(map).map((c) => [c.cx, c.cz]) }
}

/** Rebuild a map from untrusted save data; invalid entries are dropped. */
export function deserializeMap(raw: unknown): MapState {
  if (typeof raw !== 'object' || raw === null) return EMPTY_MAP
  const cells = (raw as { cells?: unknown }).cells
  if (!Array.isArray(cells)) return EMPTY_MAP
  const explored: Record<string, true> = {}
  for (const entry of cells) {
    if (
      Array.isArray(entry) &&
      entry.length === 2 &&
      Number.isInteger(entry[0]) &&
      Number.isInteger(entry[1])
    ) {
      explored[cellKey(entry[0] + 0, entry[1] + 0)] = true
    }
  }
  return { explored }
}
