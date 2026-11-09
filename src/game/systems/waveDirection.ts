// Pure decisions behind WaveDirector (mode-aware plan, spawn options, cleared-night routing),
// kept out of the R3F component so they run in Node tests. No React, three.js or Howler.
import { LAST_NIGHT } from '../../data/balance'
import { MODES } from '../../data/modes'
import { createRng, deriveSeed, type Rng } from '../rng'
import type { ModeId } from '../types'
import { createEnemy, type AIEnemy } from './enemyAI'
import { spawnMultipliers } from './modes'
import { recordNightSurvived, type RunStats } from './runStats'
import { nightPlan, startNight, type WaveSpawn, type WaveState } from './waves'

/** The fresh wave state and wave count for a night in the given mode. */
export function planNight(mode: ModeId, night: number): { state: WaveState; totalWaves: number } {
  return { state: startNight(night, mode), totalWaves: nightPlan(mode, night).length }
}

/** Seeded streams for one night, so Retry Night replays the same spawns and elites. */
export function nightRngs(seed: number, night: number): { rng: Rng; eliteRng: Rng } {
  return {
    rng: createRng(deriveSeed(seed, 'waves', night)),
    eliteRng: createRng(deriveSeed(seed, 'elites', night)),
  }
}

/** Elite chance for the mode, passed on to the wave tick's elite roll. */
export function eliteChanceFor(mode: ModeId): number {
  return MODES[mode].eliteChance
}

/**
 * Builds the zombie for a spawn. The elite multipliers are applied once, by createEnemy from
 * `elite: true`; spawnMultipliers is asked for the non-elite part only so they do not double.
 */
export function createWaveEnemy(uid: string, s: WaveSpawn, mode: ModeId, night: number): AIEnemy {
  const m = spawnMultipliers(mode, night, false)
  return createEnemy(uid, s.type, { x: s.x, z: s.z }, { ...m, elite: s.elite })
}

export type ClearedRoute = 'rite' | 'dawn'

/** Only story modes hold night 5 for the rite; Endless goes to dawn after every night. */
export function clearedRoute(mode: ModeId, night: number): ClearedRoute {
  return MODES[mode].story && night >= LAST_NIGHT ? 'rite' : 'dawn'
}

/** Story modes stop counting at night 5; Endless counts without a cap. */
export function survivedCap(mode: ModeId): number {
  return MODES[mode].story ? LAST_NIGHT : Number.POSITIVE_INFINITY
}

/** Nights survived after a dawn-route clear. The rite route is credited by the ending instead. */
export function statsAfterClear(s: RunStats, mode: ModeId, night: number): RunStats {
  return clearedRoute(mode, night) === 'dawn' ? recordNightSurvived(s, night, survivedCap(mode)) : s
}
