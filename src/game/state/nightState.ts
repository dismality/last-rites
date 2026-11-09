// Clears everything that belongs to one night's fight, in one place. Persisted combat
// fields (magazines, durability, upgrades, pickups, built doors) are deliberately kept.
// Called by retryNight, resetRun, startEnding and when the player is taken.

import { gasRuntime } from '../../scene/effects/gasRuntime'
import { graveBurstRuntime } from '../../scene/effects/graveBurstRuntime'
import { meleeRuntime } from '../../scene/player/meleeRuntime'
import { useBossStore } from './bossStore'
import { useChapelStore } from './chapelStore'
import { useCombatStore } from './combatStore'
import { useDoorStore } from './doorStore'
import { useEffectStore } from './effectStore'
import { useEndingStore } from './endingStore'
import { useEnemyStore } from './enemyStore'
import { useFeedbackStore } from './feedbackStore'
import { useProjectileStore } from './projectileStore'
import { useCoinStore } from './coinStore'
import { musicRuntime } from './musicRuntime'
import { useScoreStore } from './scoreStore'
import { stormRuntime } from './stormRuntime'
import { emptySilence } from '../systems/scareSilence'
import { useWaveStore } from './waveStore'

export function clearNightState(): void {
  // Night score, loose coin piles, weather and music silence belong to the failed night too.
  useScoreStore.getState().resetNight()
  useCoinStore.getState().clear()
  stormRuntime.reset()
  musicRuntime.silence = emptySilence
  musicRuntime.reset()
  useEffectStore.getState().clear()
  gasRuntime.queue.length = 0
  meleeRuntime.dustQueue.length = 0
  graveBurstRuntime.queue.length = 0
  useEnemyStore.getState().setEnemies([])
  useBossStore.getState().reset()
  useFeedbackStore.getState().clear()
  useCombatStore.getState().resetLive()
  useDoorStore.getState().setNail(null)
  useProjectileStore.getState().reset()
  useWaveStore.getState().reset()
  useEndingStore.getState().setRiteStarted(false)
  useChapelStore.getState().setFinalRiteActive(false)
}
