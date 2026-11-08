// Wave director: pure state machine that sequences a night's waves.
//   active (spawning / fighting) → gap (15 s) → active … → done
// Spawns come from open graves at least SPAWN_MIN_DISTANCE from the player; at most
// LIVE_ENEMY_CAP zombies live at once, so extra spawns wait in `pending`.
// Pure TS: the scene creates the AIEnemy objects and shows the grave burst.
// Requirements 5.1–5.5.

import type { EnemyId } from '../../data/enemies'
import {
  LIVE_ENEMY_CAP,
  NIGHT_MAP,
  SPAWN_JITTER_M,
  SPAWN_MIN_DISTANCE,
  WAVE_GAP,
  WAVE_GRAVES,
  type NightNumber,
  type WaveComposition,
  type WaveGrave,
} from '../../data/waves'
import type { Rng } from '../rng'

export type WavePhase = 'idle' | 'active' | 'gap' | 'done'

export interface WaveState {
  phase: WavePhase
  night: NightNumber | null
  /** 0-based index of the current (or next, during a gap) wave. */
  waveIndex: number
  /** Enemies of the current wave still waiting for a free slot or a far grave. */
  pending: readonly EnemyId[]
  /** Seconds left in the gap before the next wave. */
  gapTimer: number
  /** Total enemies spawned this night. */
  spawned: number
}

export interface WaveSpawn {
  type: EnemyId
  graveId: string
  x: number
  z: number
}

export type WaveEvent =
  | { type: 'waveStarted'; night: NightNumber; wave: number; total: number; size: number }
  | { type: 'waveCleared'; night: NightNumber; wave: number }
  | { type: 'wavesCleared'; night: NightNumber }

export interface WaveContext {
  playerPos: { x: number; z: number }
  /** Zombies currently alive (not dying or dead). */
  liveCount: number
  rng: Rng
  graves?: readonly WaveGrave[]
}

export interface WaveTick {
  state: WaveState
  spawns: WaveSpawn[]
  events: WaveEvent[]
}

export function createWaveState(): WaveState {
  return { phase: 'idle', night: null, waveIndex: 0, pending: [], gapTimer: 0, spawned: 0 }
}

/** Expands a composition into a spawn queue; wailers last so the screamer arrives behind its pack. */
export function expandWave(w: WaveComposition): EnemyId[] {
  const q: EnemyId[] = []
  for (let i = 0; i < w.lurker; i++) q.push('lurker')
  for (let i = 0; i < w.shambler; i++) q.push('shambler')
  for (let i = 0; i < w.wailer; i++) q.push('wailer')
  return q
}

/** Total enemies a night spawns across all its waves. */
export function nightTotal(night: NightNumber): number {
  return NIGHT_MAP[night].waves.reduce((n, w) => n + w.shambler + w.wailer + w.lurker, 0)
}

/** `nightStarted(n)`: begin wave 1 immediately. */
export function startNight(night: number): WaveState {
  const def = NIGHT_MAP[night as NightNumber]
  if (!def) return createWaveState()
  return {
    phase: 'active',
    night: def.night,
    waveIndex: 0,
    pending: expandWave(def.waves[0]),
    gapTimer: 0,
    spawned: 0,
  }
}

/**
 * Final-rite assault: when the rite starts after night 5's waves are already cleared, one more
 * wave (the night's strongest) rises so the rite is always held under attack (Req 5.3).
 */
export function startRiteAssault(): WaveState {
  const def = NIGHT_MAP[5]
  const last = def.waves.length - 1
  return {
    phase: 'active',
    night: def.night,
    waveIndex: last,
    pending: expandWave(def.waves[last]),
    gapTimer: 0,
    spawned: 0,
  }
}

/** Graves far enough from the player to burst without spawning in their face. */
export function eligibleGraves(
  graves: readonly WaveGrave[],
  playerPos: { x: number; z: number },
  minDistance = SPAWN_MIN_DISTANCE,
): WaveGrave[] {
  return graves.filter((g) => Math.hypot(g.x - playerPos.x, g.z - playerPos.z) >= minDistance)
}

export function tickWaves(state: WaveState, dt: number, ctx: WaveContext): WaveTick {
  const events: WaveEvent[] = []
  const spawns: WaveSpawn[] = []
  if (state.phase === 'idle' || state.phase === 'done' || state.night === null) {
    return { state, spawns, events }
  }
  const def = NIGHT_MAP[state.night]

  if (state.phase === 'gap') {
    const gapTimer = state.gapTimer - dt
    if (gapTimer > 0) return { state: { ...state, gapTimer }, spawns, events }
    const w = def.waves[state.waveIndex]
    events.push({
      type: 'waveStarted',
      night: def.night,
      wave: state.waveIndex + 1,
      total: def.waves.length,
      size: w.shambler + w.wailer + w.lurker,
    })
    return {
      state: { ...state, phase: 'active', pending: expandWave(w), gapTimer: 0 },
      spawns,
      events,
    }
  }

  // active: spawn what the cap and the grave distance allow.
  const graves = eligibleGraves(ctx.graves ?? WAVE_GRAVES, ctx.playerPos)
  const room = Math.max(0, LIVE_ENEMY_CAP - ctx.liveCount)
  const count = graves.length === 0 ? 0 : Math.min(room, state.pending.length)
  // Walk the eligible graves from a random start so one burst uses different graves,
  // then jitter each spawn so a wave larger than the grave count still doesn't stack.
  const start = graves.length === 0 ? 0 : Math.floor(ctx.rng() * graves.length)
  for (let i = 0; i < count; i++) {
    const g = graves[(start + i) % graves.length]
    spawns.push({
      type: state.pending[i],
      graveId: g.id,
      x: g.x + (ctx.rng() * 2 - 1) * SPAWN_JITTER_M,
      z: g.z + (ctx.rng() * 2 - 1) * SPAWN_JITTER_M,
    })
  }
  const pending = state.pending.slice(count)
  const spawned = state.spawned + count

  // Cleared only when nothing is queued, nothing alive, and nothing just spawned.
  if (pending.length === 0 && count === 0 && ctx.liveCount === 0) {
    events.push({ type: 'waveCleared', night: def.night, wave: state.waveIndex + 1 })
    const next = state.waveIndex + 1
    if (next >= def.waves.length) {
      events.push({ type: 'wavesCleared', night: def.night })
      return { state: { ...state, phase: 'done', pending, spawned }, spawns, events }
    }
    return {
      state: { ...state, phase: 'gap', waveIndex: next, pending, gapTimer: WAVE_GAP, spawned },
      spawns,
      events,
    }
  }
  return { state: { ...state, pending, spawned }, spawns, events }
}
