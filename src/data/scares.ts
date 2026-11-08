// Scare events and trigger zones — mirrored from docs/game-design.md §9.
// Every event is telegraphed 0.5–1.5 s beforehand (horror-design jumpscare contract).
// Pure data: no logic, no side effects.

import type { AudioCueId } from './enemies'
import type { Vec3 } from './cemeteryLayout'
import type { ZoneId } from './zones'

export type ScareEventId =
  | 'statue-turn'
  | 'candle-snuff'
  | 'whisper-name'
  | 'breath-behind'
  | 'door-slam'
  | 'lurker-lunge'
  | 'hand-from-grave'
  | 'false-quiet'

export type ScareTier = 'minor' | 'major' | 'none'

/** Telegraph-only sounds that no enemy owns. The AudioManager maps these to files later. */
export type ScareCueId = 'stone-grind' | 'wind-gust' | 'door-creak' | 'soil-crumble'

export type TelegraphCue = AudioCueId | ScareCueId | 'flicker' | 'silence'

/** Telegraph lead-time bounds in seconds. */
export const TELEGRAPH_LEAD_MIN_S = 0.5
export const TELEGRAPH_LEAD_MAX_S = 1.5

export interface ScareEventDef {
  id: ScareEventId
  tier: ScareTier
  telegraph: { cue: TelegraphCue; lead: number }
  /** Shown at intensity Off, and with subtitles on. */
  subtitle: string
  /** Relative pick weight inside a zone's event list. */
  weight: number
}

export const SCARE_EVENTS: readonly ScareEventDef[] = [
  {
    id: 'statue-turn',
    tier: 'minor',
    telegraph: { cue: 'stone-grind', lead: 1.0 },
    subtitle: '[stone grinding behind you]',
    weight: 3,
  },
  {
    id: 'candle-snuff',
    tier: 'minor',
    telegraph: { cue: 'wind-gust', lead: 0.8 },
    subtitle: '[a cold gust; candles go out one by one]',
    weight: 3,
  },
  {
    id: 'whisper-name',
    tier: 'minor',
    telegraph: { cue: 'silence', lead: 1.0 },
    subtitle: '[a whisper: "...keeper..."]',
    weight: 3,
  },
  {
    id: 'breath-behind',
    tier: 'minor',
    telegraph: { cue: 'flicker', lead: 1.0 },
    subtitle: '[heavy breathing behind you]',
    weight: 2,
  },
  {
    id: 'door-slam',
    tier: 'major',
    telegraph: { cue: 'door-creak', lead: 1.0 },
    subtitle: '[a crypt door slams shut]',
    weight: 2,
  },
  {
    id: 'lurker-lunge',
    tier: 'major',
    telegraph: { cue: 'silence', lead: 1.5 },
    subtitle: '[silence, then a sharp breath]',
    weight: 2,
  },
  {
    id: 'hand-from-grave',
    tier: 'major',
    telegraph: { cue: 'soil-crumble', lead: 0.8 },
    subtitle: '[soil crumbling; a hand grabs your ankle]',
    weight: 2,
  },
  {
    id: 'false-quiet',
    tier: 'none',
    telegraph: { cue: 'silence', lead: 0.5 },
    subtitle: '[an unnatural quiet]',
    weight: 2,
  },
]

export const SCARE_EVENT_MAP: Readonly<Record<ScareEventId, ScareEventDef>> = Object.fromEntries(
  SCARE_EVENTS.map((e) => [e.id, e]),
) as Record<ScareEventId, ScareEventDef>

/** Axis-aligned box in world space (+X east, +Z south). */
export interface Box3Like {
  min: Vec3
  max: Vec3
}

export interface ScareZone {
  id: string
  zone: ZoneId
  bounds: Box3Like
  /** Events this zone may roll; the first zone of the game must include statue-turn. */
  events: readonly ScareEventId[]
}

/**
 * Bounds follow cemeteryLayout.ts: Mausoleum Row runs z -40..-60 at x -20 (3.5 m wide),
 * the catacombs run z 40..60 at x 25 (2.5 m wide).
 */
export const SCARE_ZONES: readonly ScareZone[] = [
  // The first scare on the grounds is the mild statue-turn (horror-design: first scare within 3 minutes).
  {
    id: 'grounds-oak-path',
    zone: 'grounds',
    bounds: { min: [-16, 0, -22], max: [-8, 4, -12] },
    events: ['statue-turn', 'whisper-name', 'false-quiet'],
  },
  {
    id: 'grounds-west-hill',
    zone: 'grounds',
    bounds: { min: [-36, 0, 4], max: [-26, 4, 14] },
    events: ['whisper-name', 'hand-from-grave', 'candle-snuff', 'false-quiet'],
  },
  {
    id: 'row-alley-entrance',
    zone: 'mausoleum-row',
    bounds: { min: [-21.5, 0, -48], max: [-18.5, 4, -42] },
    events: ['statue-turn', 'breath-behind', 'false-quiet'],
  },
  {
    id: 'row-alley-middle',
    zone: 'mausoleum-row',
    bounds: { min: [-21.5, 0, -54], max: [-18.5, 4, -48] },
    events: ['door-slam', 'lurker-lunge', 'candle-snuff', 'whisper-name'],
  },
  {
    id: 'row-alley-end',
    zone: 'mausoleum-row',
    bounds: { min: [-21.5, 0, -60], max: [-18.5, 4, -54] },
    events: ['lurker-lunge', 'door-slam', 'breath-behind', 'false-quiet'],
  },
  {
    id: 'catacombs-stair',
    zone: 'catacombs',
    bounds: { min: [23.8, 0, 40], max: [26.2, 2.2, 50] },
    events: ['whisper-name', 'breath-behind', 'hand-from-grave', 'false-quiet'],
  },
  {
    id: 'catacombs-ossuary',
    zone: 'catacombs',
    bounds: { min: [23.8, 0, 50], max: [26.2, 2.2, 60] },
    events: ['lurker-lunge', 'breath-behind', 'candle-snuff', 'whisper-name'],
  },
]

// --- Staging data (scene layer) ---------------------------------------------
// Props the stager animates. All positions are world space, visual only (no colliders),
// so a staged prop can never trap or block the player.

export interface StatueAnchor {
  zoneId: string
  position: Vec3
  /** Yaw (radians) while turned away from the player's approach. */
  awayYaw: number
}

export interface DoorAnchor {
  zoneId: string
  /** Hinge position. */
  position: Vec3
  /** Yaw of the leaf when shut. */
  shutYaw: number
}

export interface CandleCluster {
  zoneId: string
  positions: readonly Vec3[]
}

export interface NicheAnchor {
  zoneId: string
  position: Vec3
}

export const SCARE_STATUES: readonly StatueAnchor[] = [
  { zoneId: 'grounds-oak-path', position: [-12, 0, -17], awayYaw: Math.PI },
  { zoneId: 'row-alley-entrance', position: [-17.9, 0, -45], awayYaw: Math.PI / 2 },
]

export const SCARE_DOORS: readonly DoorAnchor[] = [
  { zoneId: 'row-alley-middle', position: [-21.8, 0, -51], shutYaw: Math.PI / 2 },
  { zoneId: 'row-alley-middle', position: [-18.2, 0, -52.5], shutYaw: -Math.PI / 2 },
  { zoneId: 'row-alley-end', position: [-21.8, 0, -56], shutYaw: Math.PI / 2 },
  { zoneId: 'row-alley-end', position: [-18.2, 0, -58], shutYaw: -Math.PI / 2 },
]

export const SCARE_CANDLES: readonly CandleCluster[] = [
  {
    zoneId: 'grounds-west-hill',
    positions: [
      [-33, 0, 6],
      [-31, 0, 9],
      [-28.5, 0, 12],
    ],
  },
  {
    zoneId: 'row-alley-middle',
    positions: [
      [-21.3, 0, -49],
      [-18.7, 0, -50.5],
      [-21.3, 0, -52],
      [-18.7, 0, -53.5],
    ],
  },
  {
    zoneId: 'catacombs-ossuary',
    positions: [
      [24.2, 0, 52],
      [25.8, 0, 54.5],
      [24.2, 0, 57],
    ],
  },
]

export const SCARE_NICHES: readonly NicheAnchor[] = [
  { zoneId: 'row-alley-middle', position: [-21.2, 0, -52.5] },
  { zoneId: 'row-alley-end', position: [-18.8, 0, -58] },
  { zoneId: 'catacombs-ossuary', position: [25.5, 0, 58.5] },
]

/** Tuning for the staged effects (no magic numbers in the stager). */
export const SCARE_STAGING = {
  /** Half-angle of the player's view cone for "is the player looking at it". */
  viewHalfAngleDeg: 50,
  /** A statue that never gets a moment out of sight gives up after this long. */
  statueMaxWaitS: 8,
  /** Statues snap back once the player is this far away and not looking. */
  statueResetDistanceM: 12,
  candleSnuffIntervalS: 0.3,
  candleRelightAfterS: 30,
  doorCreakAngle: 0.5,
  doorSlamS: 0.12,
  doorHoldShutS: 4,
  /** Hand-from-grave: movement multiplier and duration (design bible §9). */
  handSlowFactor: 0.5,
  handSlowS: 2,
  handRiseS: 0.25,
  /** Lantern flicker length for the breath-behind telegraph. */
  flickerS: 1,
  /** How long the ambient bed stays ducked for silence-based telegraphs. */
  duckAfterBeatS: 0.6,
  falseQuietS: 3,
  whisperSideM: 1.6,
  breathBehindM: 1.0,
  /** Lurker spawns a short breath before launching (EnemyAI telegraph is 0.8 s). */
  lurkerPreLungeS: 0.4,
  /** Camera shake length for a major beat. */
  shakeS: 0.25,
  subtitleS: 3,
} as const
