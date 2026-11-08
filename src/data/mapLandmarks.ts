// Journal map content: grid constants and landmark list (Requirement 6.1, 6.3).
// Pure data: no logic, no React / three.js imports.

import type { RelicId } from '../game/types'
import { BENCH_Z, CHAPEL_CENTER, CORRIDORS, PLAYABLE_BOUNDS, type Vec3 } from './cemeteryLayout'
import { FIXED_SPAWNS } from './zones'

/** Side of one map cell in metres (Requirement 6.1). */
export const MAP_CELL_SIZE = 8

/** Inclusive cell range covering the whole playable area, used to size the sheet. */
export const MAP_EXTENT = {
  minCx: Math.floor(-PLAYABLE_BOUNDS.halfX / MAP_CELL_SIZE),
  maxCx: Math.floor(PLAYABLE_BOUNDS.halfX / MAP_CELL_SIZE),
  minCz: Math.floor(-PLAYABLE_BOUNDS.halfZ / MAP_CELL_SIZE),
  maxCz: Math.floor(PLAYABLE_BOUNDS.halfZ / MAP_CELL_SIZE),
} as const

export type LandmarkKind = 'workbench' | 'chapel' | 'gate' | 'relic'

export interface Landmark {
  id: string
  kind: LandmarkKind
  name: string
  /** World position; its cell must be explored before the icon appears. */
  position: Vec3
  /** Only drawn at night, matching the item it marks (Requirement 7.3). */
  nightOnly?: boolean
}

const RELIC_NAMES: Readonly<Record<RelicId, string>> = {
  'crane-rosary': "Crane's Rosary",
  'sextons-bell-clapper': "Sexton's Bell Clapper",
  'childs-locket': "Child's Locket",
  'burial-shroud': 'Burial Shroud',
  'reliquary-heart': 'Reliquary Heart',
}

const GATE_NAMES: Readonly<Record<string, string>> = {
  'mausoleum-row': 'Mausoleum Row gate',
  catacombs: 'Catacombs gate',
}

const RELIC_SITES: Landmark[] = FIXED_SPAWNS.flatMap((s) =>
  s.item in RELIC_NAMES
    ? [
        {
          id: `relic-${s.item}`,
          kind: 'relic' as const,
          name: `Relic site: ${RELIC_NAMES[s.item as RelicId]}`,
          position: s.position,
          nightOnly: s.nightOnly,
        },
      ]
    : [],
)

export const LANDMARKS: readonly Landmark[] = [
  { id: 'workbench', kind: 'workbench', name: 'Workbench', position: [0, 0, BENCH_Z] },
  { id: 'chapel', kind: 'chapel', name: 'Chapel', position: CHAPEL_CENTER },
  ...CORRIDORS.map((c) => ({
    id: `gate-${c.id}`,
    kind: 'gate' as const,
    name: GATE_NAMES[c.id] ?? 'Gate',
    position: [c.centerX, 0, c.entranceZ] as Vec3,
  })),
  ...RELIC_SITES,
]

/** Pencil-sketch timing (ms). Reduced-motion users get a plain fade of the same length. */
export const MAP_INK = {
  cellDurationMs: 500,
  /** Delay between consecutive newly inked cells so they draw in one after another. */
  staggerMs: 90,
  /** Cap so a large backlog never takes more than ~1.5 s to finish. */
  maxTotalDelayMs: 1000,
} as const
