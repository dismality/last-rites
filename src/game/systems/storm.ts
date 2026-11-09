// Storm rolls and the lightning schedule (spec 08 Req 10, 13.6 to 13.8). Pure TypeScript.
// Every random draw is derived from the run seed, so Retry Night replays the same storm.
import { LIGHTNING, STORM, STORM_CHANCE_DAY, STORM_CHANCE_NIGHT } from '../../data/storms'
import { createRng, deriveSeed, type Rng } from '../rng'

export interface StormState {
  active: boolean
  /** Seconds until the next strike; null when no strike is scheduled. Waits at 0 during a beat. */
  strikeIn: number | null
  /** Index k of the strike whose gap `strikeIn` counts down to. */
  strikeIndex: number
  thunder: readonly { inS: number; close: boolean }[]
  /** Seconds since the last strike began; null when no flash is showing. */
  flashAge: number | null
  slow: boolean
}

export type StormEvent =
  | { type: 'stormStarted' }
  | { type: 'stormEnded' }
  | { type: 'strike'; slow: boolean }
  | { type: 'thunder'; close: boolean }

export interface StormTickContext {
  seed: number
  night: number
  beatPending: boolean
  flashingLights: boolean
}

/** Chance of a storm when a day or night starts; a night with no table entry is 0. */
export function stormChance(kind: 'day' | 'night', night: number): number {
  if (kind === 'day') return STORM_CHANCE_DAY
  return STORM_CHANCE_NIGHT[night] ?? 0
}

/** `rng() < chance`, so a chance of 0 never rolls a storm and 1 always does. */
export function rollStorm(rng: Rng, chance: number): boolean {
  return rng() < chance
}

// Night is multiplied so each night's strike indices never collide with another night's stream.
function strikeRng(seed: number, night: number, k: number): Rng {
  return createRng(deriveSeed(seed, 'lightning', night * STORM.nightSeedStride + k))
}

function drawGap(seed: number, night: number, k: number): number {
  return STORM.gapMinS + (STORM.gapMaxS - STORM.gapMinS) * strikeRng(seed, night, k)()
}

function drawThunderDelay(seed: number, night: number, k: number): number {
  const rng = strikeRng(seed, night, k)
  rng() // the first draw of each strike's stream is its gap
  return STORM.thunderMinS + (STORM.thunderMaxS - STORM.thunderMinS) * rng()
}

export function startStorm(seed: number, night: number): StormState {
  return {
    active: true,
    strikeIn: drawGap(seed, night, 0),
    strikeIndex: 0,
    thunder: [],
    flashAge: null,
    slow: false,
  }
}

export function tickStorm(
  s: StormState,
  dt: number,
  c: StormTickContext,
): { state: StormState; events: StormEvent[] } {
  const events: StormEvent[] = []

  // Count down thunder scheduled before this tick; thunder from a strike below starts next tick.
  const pending: { inS: number; close: boolean }[] = []
  for (const t of s.thunder) {
    const inS = t.inS - dt
    if (inS <= 0) events.push({ type: 'thunder', close: t.close })
    else pending.push({ inS, close: t.close })
  }

  let flashAge = s.flashAge === null ? null : s.flashAge + dt
  if (flashAge !== null) {
    const length = s.slow ? LIGHTNING.slowRiseS + LIGHTNING.slowFallS : LIGHTNING.flashS
    if (flashAge >= length) flashAge = null
  }

  let { strikeIn, strikeIndex, slow } = s
  if (s.active && strikeIn !== null) {
    strikeIn = Math.max(0, strikeIn - dt)
    // A strike that is due waits at 0 while a beat is pending, then fires on the first free tick.
    if (strikeIn === 0 && !c.beatPending) {
      const delay = drawThunderDelay(c.seed, c.night, strikeIndex)
      slow = !c.flashingLights
      flashAge = 0
      pending.push({ inS: delay, close: delay <= STORM.closeThunderMaxS })
      strikeIndex += 1
      strikeIn = drawGap(c.seed, c.night, strikeIndex)
      events.push({ type: 'strike', slow })
    }
  }

  return {
    state: { active: s.active, strikeIn, strikeIndex, thunder: pending, flashAge, slow },
    events,
  }
}

/** Flash brightness 0..1 at `age` seconds after a strike; null age means no flash. Slow is a linear ramp, so it never jumps. */
export function lightningLevel(age: number | null, slow: boolean): number {
  if (age === null || age < 0) return 0
  if (!slow) return age < LIGHTNING.flashS ? 1 : 0
  const total = LIGHTNING.slowRiseS + LIGHTNING.slowFallS
  if (age >= total) return 0
  if (age <= LIGHTNING.slowRiseS) return (LIGHTNING.slowPeak * age) / LIGHTNING.slowRiseS
  return (LIGHTNING.slowPeak * (total - age)) / LIGHTNING.slowFallS
}

/** Ends the storm: no more strikes, but thunder already scheduled still plays and a flash finishes. */
export function endStorm(s: StormState): { state: StormState; events: StormEvent[] } {
  if (!s.active) return { state: s, events: [] }
  return {
    state: { ...s, active: false, strikeIn: null },
    events: [{ type: 'stormEnded' }],
  }
}

/** Fog and lantern-drain modifiers; neutral when no storm is active. */
export function stormModifiers(active: boolean): { fogAdd: number; lanternDrainMult: number } {
  return active
    ? { fogAdd: STORM.fogAdd, lanternDrainMult: STORM.lanternDrainMult }
    : { fogAdd: 0, lanternDrainMult: 1 }
}

/** Thunder shakes the camera only with Camera shake on and Scare intensity at Full. */
export function thunderShakes(settings: {
  cameraShake: boolean
  scareIntensity: 'full' | 'reduced' | 'off'
}): boolean {
  return settings.cameraShake && settings.scareIntensity === 'full'
}
