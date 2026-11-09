// Mode multipliers for spawns and lantern drain. Pure rules: no React, three.js or Howler.
// Father Crane is never scaled by mode: callers simply do not use spawnMultipliers for him.

import { UPGRADE_PER_RANK } from '../../data/dawnUpgrades'
import { ELITE } from '../../data/elites'
import { ENDLESS, MODES } from '../../data/modes'
import { STORM } from '../../data/storms'
import type { ModeId } from '../types'

export interface SpawnMultipliers {
  hpMult: number
  speedMult: number
  damageMult: number
}

/** Endless HP grows by a fixed factor per night after night 5; story modes never scale. */
export function endlessHpScale(mode: ModeId, night: number): number {
  if (mode !== 'endless' || !Number.isFinite(night)) return 1
  const extra = Math.max(0, Math.floor(night) - ENDLESS.hpScaleAfterNight)
  return Math.pow(ENDLESS.hpScale, extra)
}

/** The three createEnemy options for one spawn: mode, Endless scaling and the elite multipliers. */
export function spawnMultipliers(mode: ModeId, night: number, elite: boolean): SpawnMultipliers {
  const def = MODES[mode]
  return {
    hpMult: def.hpMult * endlessHpScale(mode, night) * (elite ? ELITE.hpMult : 1),
    speedMult: elite ? ELITE.speedMult : 1,
    damageMult: def.damageMult * (elite ? ELITE.damageMult : 1),
  }
}

/** Mode × Long Wick × storm, in one place so the lantern tick takes a single number. */
export function lanternDrainMultiplier(mode: ModeId, longWickRank: number, storm: boolean): number {
  const wick = 1 - UPGRADE_PER_RANK.lanternDrain * Math.max(0, longWickRank)
  return MODES[mode].lanternDrainMult * wick * (storm ? STORM.lanternDrainMult : 1)
}
