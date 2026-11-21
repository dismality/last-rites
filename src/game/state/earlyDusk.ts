// Early dusk (playtest 11r): once the stage's day work is done and every clue is linked, waiting
// out the clock is dead time. The chapel altar's bell then calls the dusk at once, for a small
// score bonus. Reads and writes stores; the readiness rule is `stageReadyForDusk` in systems.
import { CHAPEL_ALTAR } from '../../data/cemeteryLayout'
import { EARLY_DUSK_LINE, EARLY_DUSK_SCORE } from '../../data/objectiveRules'
import { emit } from '../events'
import { emitCombatSound } from './combatSounds'
import { earlyDuskReady } from './guidanceTick'
import { deriveTickInput } from './progressionTick'
import { useProgressionStore } from './progressionStore'
import { useWorldStore } from './worldStore'

/** Seconds the early-dusk line stays up. */
const LINE_S = 3.5

/**
 * Ring for an early dusk when the case is ready by day. Returns false (and does nothing) otherwise.
 * The day clock jumps to its end, so the next fixed step enters dusk with its usual events.
 */
export function callDuskEarly(): boolean {
  if (!earlyDuskReady()) return false
  const world = useWorldStore.getState()
  const end = deriveTickInput().dayLengthS
  // Already rung, waiting for the next step to enter dusk: a second press pays nothing.
  if (world.phaseTime >= end) return false
  world.setPhaseTime(end)
  const p = useProgressionStore.getState()
  p.patch({ score: p.score + EARLY_DUSK_SCORE })
  emitCombatSound('toll', { x: CHAPEL_ALTAR[0], y: CHAPEL_ALTAR[1], z: CHAPEL_ALTAR[2] })
  emit({ type: 'subtitleShown', text: `${EARLY_DUSK_LINE} (+${EARLY_DUSK_SCORE})`, duration: LINE_S })
  return true
}
