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
import { waveSize } from '../../data/waves'
import { DEFAULT_MODE } from '../../data/modes'
import type { Rng } from '../rng'
import type { ModeId } from '../types'
import { endlessNight } from './endless'
import { canBeDoorAttacker, doorAttackerCount } from './barricade'
import { rollElite } from './elites'

export type WavePhase = 'idle' | 'active' | 'gap' | 'done'

export interface WaveState {
  phase: WavePhase
  night: number | null
  /** The night's compositions, fixed when it starts (story table or Endless generator). */
  plan: readonly WaveComposition[]
  /** 0-based index of the current (or next, during a gap) wave. */
  waveIndex: number
  /** Enemies of the current wave still waiting for a free slot or a far grave. */
  pending: readonly EnemyId[]
  /** Seconds left in the gap before the next wave. */
  gapTimer: number
  /** Total enemies spawned this night. */
  spawned: number
  /** An elite already spawned this wave (at most one per wave). Reset at every wave start. */
  eliteSpawned: boolean
  /** Door_Attacker slots still unassigned this wave. Reset at every wave start. */
  attackersLeft: number
}

export interface WaveSpawn {
  type: EnemyId
  graveId: string
  x: number
  z: number
  elite: boolean
  doorAttacker: boolean
}

export type WaveEvent =
  | { type: 'waveStarted'; night: number; wave: number; total: number; size: number }
  | { type: 'waveCleared'; night: number; wave: number }
  | { type: 'wavesCleared'; night: number }

export interface WaveContext {
  playerPos: { x: number; z: number }
  /** Zombies currently alive (not dying or dead). */
  liveCount: number
  rng: Rng
  graves?: readonly WaveGrave[]
  /** Separate stream for elite rolls so base seeds are unchanged; without it no elite is rolled. */
  eliteRng?: Rng
  /** Mode elite chance; defaults to Normal's. */
  eliteChance?: number
}

export interface WaveTick {
  state: WaveState
  spawns: WaveSpawn[]
  events: WaveEvent[]
}

export function createWaveState(): WaveState {
  return { phase: 'idle', night: null, plan: [], waveIndex: 0, pending: [], gapTimer: 0,
    spawned: 0,
    eliteSpawned: false,
    attackersLeft: 0,
  }
}

/** Expands a composition into a spawn queue; wailers last so the screamer arrives behind its pack. */
export function expandWave(w: WaveComposition): EnemyId[] {
  const q: EnemyId[] = []
  for (let i = 0; i < w.lurker; i++) q.push('lurker')
  for (let i = 0; i < w.shambler; i++) q.push('shambler')
  for (let i = 0; i < w.brute; i++) q.push('brute')
  for (let i = 0; i < w.bloater; i++) q.push('bloater')
  for (let i = 0; i < w.wailer; i++) q.push('wailer')
  return q
}

/** Total enemies a night spawns across all its waves. */
export function nightTotal(night: number, mode: ModeId = DEFAULT_MODE): number {
  return nightPlan(mode, night).reduce((n, w) => n + waveSize(w), 0)
}

/** Waves of a night: the story table (with spec 07 additions) or the Endless generator. Empty if none. */
export function nightPlan(mode: ModeId, night: number): readonly WaveComposition[] {
  if (mode === 'endless') return Number.isFinite(night) && night >= 1 ? endlessNight(night).waves : []
  return NIGHT_MAP[night as NightNumber]?.waves ?? []
}

/** `nightStarted(n)`: begin wave 1 immediately. */
export function startNight(night: number, mode: ModeId = DEFAULT_MODE): WaveState {
  const plan = nightPlan(mode, night)
  if (plan.length === 0) return createWaveState()
  return {
    phase: 'active',
    night,
    plan,
    waveIndex: 0,
    pending: expandWave(plan[0]),
    gapTimer: 0,
    spawned: 0,
    eliteSpawned: false,
    attackersLeft: doorAttackerCount(waveSize(plan[0]), night),
  }
}

/**
 * Final-rite assault: when the rite starts after night 5's waves are already cleared, one more
 * wave (the night's strongest) rises so the rite is always held under attack (Req 5.3).
 */
export function startRiteAssault(): WaveState {
  const plan = NIGHT_MAP[5].waves
  const last = plan.length - 1
  return {
    phase: 'active',
    night: 5,
    plan,
    waveIndex: last,
    pending: expandWave(plan[last]),
    gapTimer: 0,
    spawned: 0,
    eliteSpawned: false,
    attackersLeft: doorAttackerCount(waveSize(plan[last]), 5),
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
  const def = { night: state.night, waves: state.plan }
  if (def.waves.length === 0) return { state, spawns, events }

  if (state.phase === 'gap') {
    const gapTimer = state.gapTimer - dt
    if (gapTimer > 0) return { state: { ...state, gapTimer }, spawns, events }
    const w = def.waves[state.waveIndex]
    events.push({
      type: 'waveStarted',
      night: def.night,
      wave: state.waveIndex + 1,
      total: def.waves.length,
      size: waveSize(w),
    })
    return {
      state: {
        ...state,
        phase: 'active',
        pending: expandWave(w),
        gapTimer: 0,
        eliteSpawned: false,
        attackersLeft: doorAttackerCount(waveSize(w), def.night),
      },
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
  let eliteSpawned = state.eliteSpawned
  let attackersLeft = state.attackersLeft
  for (let i = 0; i < count; i++) {
    const g = graves[(start + i) % graves.length]
    const type = state.pending[i]
    const x = g.x + (ctx.rng() * 2 - 1) * SPAWN_JITTER_M
    const z = g.z + (ctx.rng() * 2 - 1) * SPAWN_JITTER_M
    const elite = ctx.eliteRng ? rollElite(ctx.eliteRng, type, def.night, eliteSpawned, ctx.eliteChance) : false
    if (elite) eliteSpawned = true
    const doorAttacker = attackersLeft > 0 && canBeDoorAttacker(type)
    if (doorAttacker) attackersLeft--
    spawns.push({ type, graveId: g.id, x, z, elite, doorAttacker })
  }
  const pending = state.pending.slice(count)
  const spawned = state.spawned + count
  const wave = { eliteSpawned, attackersLeft }

  // Cleared only when nothing is queued, nothing alive, and nothing just spawned.
  if (pending.length === 0 && count === 0 && ctx.liveCount === 0) {
    events.push({ type: 'waveCleared', night: def.night, wave: state.waveIndex + 1 })
    const next = state.waveIndex + 1
    if (next >= def.waves.length) {
      events.push({ type: 'wavesCleared', night: def.night })
      return { state: { ...state, ...wave, phase: 'done', pending, spawned }, spawns, events }
    }
    return {
      state: { ...state, ...wave, phase: 'gap', waveIndex: next, pending, gapTimer: WAVE_GAP, spawned },
      spawns,
      events,
    }
  }
  return { state: { ...state, ...wave, pending, spawned }, spawns, events }
}
