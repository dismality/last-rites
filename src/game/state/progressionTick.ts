// Fixed-step glue for progression: combo decay, coin piles, run time, storm and music
// (design "Timing"). Called once per fixed step from GameLoop after tickCombat.
// Reads stores, holds no rules; the pure functions it calls live in src/game/systems/.
import { CAPTION_MAP } from '../../data/captions'
import { DAY_DURATION_S } from '../../data/balance'
import { STAGE_COUNT } from '../../data/stages'
import { MODES } from '../../data/modes'
import { emit } from '../events'
import { stepPiles } from '../systems/coins'
import { musicLayer } from '../systems/musicLayer'
import { currentWeights, stepMixer } from '../systems/musicMixer'
import { beatImminent, isSilent } from '../systems/scareSilence'
import { recordCoins, recordTime } from '../systems/runStats'
import { tickCombo } from '../systems/score'
import { endStorm, lightningLevel, startStorm, tickStorm } from '../systems/storm'
import { useBossStore } from './bossStore'
import { useCoinStore } from './coinStore'
import { useEnemyStore } from './enemyStore'
import { useGameStore } from './gameStore'
import { isSimFrozen } from './menuState'
import { musicRuntime } from './musicRuntime'
import { usePlayerStore } from './playerStore'
import { useProgressionStore } from './progressionStore'
import { useScoreStore } from './scoreStore'
import { useSettingsStore } from './settingsStore'
import { simClock, stepSimClock } from './simClock'
import { stormRuntime } from './stormRuntime'
import { useStageStore } from './stageStore'
import { useWaveStore } from './waveStore'
import { useWorldStore } from './worldStore'

/** What the day/night tick needs from progression (design "Dawn hold"). */
export interface ProgressionTickInput {
  holdDawn: boolean
  dayLengthS: number
  lastNight: number
  /** Story stages only: the case-solved flag and the wave index for fog. Absent in Endless. */
  caseSolved?: boolean
  waveIndex?: number
}

/** Hold, day length and last night for the current mode. Story modes keep the defaults. */
export function deriveTickInput(): ProgressionTickInput {
  const p = useProgressionStore.getState()
  const mode = MODES[p.mode]
  return {
    holdDawn: p.pendingPick !== null,
    dayLengthS: mode.dayLengthS ?? DAY_DURATION_S,
    lastNight: mode.story ? STAGE_COUNT : Infinity,
    ...(mode.story
      ? { caseSolved: useStageStore.getState().caseSolved, waveIndex: useWaveStore.getState().waves.waveIndex }
      : {}),
  }
}

const DEAD_STATES: readonly string[] = ['dying', 'dead']

/** Distance to the nearest living zombie; Infinity when none exists (dormant lurkers count). */
function nearestZombieM(px: number, pz: number): number {
  let best = Infinity
  for (const e of useEnemyStore.getState().enemies) {
    if (DEAD_STATES.includes(e.state)) continue
    best = Math.min(best, Math.hypot(e.pos.x - px, e.pos.z - pz))
  }
  return best
}

function stepCombo(): void {
  const sc = useScoreStore.getState()
  const p = useProgressionStore.getState()
  const before = {
    score: p.score,
    bossScored: p.bossScored,
    combo: sc.combo,
    lastKillAt: sc.lastKillAt,
    seen: sc.seen,
    nightKillPoints: sc.nightKillPoints,
  }
  const next = tickCombo(before, simClock.now)
  if (next !== before) sc.patch({ combo: next.combo, lastKillAt: next.lastKillAt })
}

function stepCoins(dt: number): void {
  const coins = useCoinStore.getState()
  if (coins.piles.length === 0) return
  const [px, , pz] = usePlayerStore.getState().position
  const r = stepPiles(coins.piles, dt, { x: px, z: pz })
  coins.setPiles(r.piles)
  if (r.collected.length === 0) return
  // Amounts come from the piles before the step, so each id banks exactly once.
  const gained = coins.piles
    .filter((p) => r.collected.includes(p.id))
    .reduce((n, p) => n + p.amount, 0)
  const store = useProgressionStore.getState()
  store.addCoins(gained)
  store.patch({ stats: recordCoins(store.stats, gained, 0) })
  if (useSettingsStore.getState().subtitles) {
    const c = CAPTION_MAP['coins-collected']
    for (const id of r.collected) {
      const amount = coins.piles.find((p) => p.id === id)?.amount ?? 0
      emit({ type: 'subtitleShown', text: c.text.replace('N', String(amount)), duration: c.minSeconds })
    }
  }
}

function stepStormRuntime(dt: number): void {
  const p = useProgressionStore.getState()
  const world = useWorldStore.getState()
  let storm = stormRuntime.storm
  // The saved flag is the source of truth; after a load the first gap is redrawn from the seed.
  if (p.storm.active && !storm.active) storm = startStorm(p.seed, world.nightNumber)
  else if (!p.storm.active && storm.active) storm = endStorm(storm).state
  const r = tickStorm(storm, dt, {
    seed: p.seed,
    night: world.nightNumber,
    beatPending: beatImminent(musicRuntime.silence),
    flashingLights: useSettingsStore.getState().flashingLights,
  })
  stormRuntime.storm = r.state
  stormRuntime.flashLevel = lightningLevel(r.state.flashAge, r.state.slow)
  for (const e of r.events) {
    if (e.type === 'thunder') emit({ type: 'thunderRolled', close: e.close })
  }
}

function stepMusic(dt: number): void {
  const world = useWorldStore.getState()
  const [px, , pz] = usePlayerStore.getState().position
  const layer = musicLayer({
    phase: world.phase,
    waveRunning: useWaveStore.getState().waves.phase === 'active',
    nearestZombieM: nearestZombieM(px, pz),
    bossOnField: useBossStore.getState().boss.stage === 'risen',
  })
  const silent = isSilent(musicRuntime.silence, simClock.now)
  const mixer = stepMixer(musicRuntime.mixer, { layer, silent }, dt)
  musicRuntime.mixer = mixer
  musicRuntime.layer = layer
  musicRuntime.master = mixer.master
  musicRuntime.stems = currentWeights(mixer)
}

/** One fixed step. Returns at once when the player is taken or the sim is frozen. */
export function progressionTick(dt: number): void {
  if (useGameStore.getState().taken || isSimFrozen()) return
  if (!Number.isFinite(dt) || dt <= 0) return

  stepSimClock(dt)
  const p = useProgressionStore.getState()
  // Time survived stops while the dawn pick is open (design bible §12 placements).
  if (p.pendingPick === null) p.patch({ stats: recordTime(p.stats, dt) })
  stepCombo()
  stepCoins(dt)
  stepStormRuntime(dt)
  stepMusic(dt)
}
