// Pure rain helpers for Weather.tsx: streak motion inside a box that follows the camera, the
// fade level, and the thunder rules. No three.js, so it runs in Node tests.
import { RAIN, STORM } from '../../data/storms'
import { emitCombatSound } from '../../game/state/combatSounds'
import { thunderShakes } from '../../game/systems/storm'

/** The rain is a single instancedMesh, so a storm costs exactly one draw call (perf budget). */
export const RAIN_DRAW_CALLS = 1

const SLANT_RAD = (RAIN.slantDeg * Math.PI) / 180
const [BOX_X, BOX_Y, BOX_Z] = RAIN.boxM

/** Streak positions in box-local coordinates, 0..box size on each axis. */
export interface RainField {
  x: Float32Array
  y: Float32Array
  z: Float32Array
}

/** Deterministic spread from a unit-interval source (inject Math.random in the scene). */
export function createRainField(random: () => number, count: number = RAIN.count): RainField {
  const x = new Float32Array(count)
  const y = new Float32Array(count)
  const z = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    x[i] = random() * BOX_X
    y[i] = random() * BOX_Y
    z[i] = random() * BOX_Z
  }
  return { x, y, z }
}

function wrap(v: number, size: number): number {
  const m = v % size
  return m < 0 ? m + size : m
}

/** Fall at the rain speed with the slant, wrapping inside the box. Frozen or bad dt: unchanged. */
export function stepRain(field: RainField, dt: number, frozen: boolean): void {
  if (frozen || !Number.isFinite(dt) || dt <= 0) return
  const dx = RAIN.speedMps * Math.sin(SLANT_RAD) * dt
  const dy = RAIN.speedMps * Math.cos(SLANT_RAD) * dt
  for (let i = 0; i < field.x.length; i++) {
    field.x[i] = wrap(field.x[i] + dx, BOX_X)
    field.y[i] = wrap(field.y[i] - dy, BOX_Y)
  }
}

/** Ease the rain level toward 1 (storm) or 0 (calm) over STORM.rainFadeS seconds. */
export function stepRainLevel(level: number, stormActive: boolean, dt: number): number {
  if (!Number.isFinite(dt) || dt <= 0) return level
  const step = dt / STORM.rainFadeS
  return stormActive ? Math.min(1, level + step) : Math.max(0, level - step)
}

export type ThunderSettings = Parameters<typeof thunderShakes>[0]

/** What one thunder roll does: which sound and caption, and whether the camera shakes. */
export function thunderResponse(
  close: boolean,
  settings: ThunderSettings,
): { sound: 'thunder-close' | 'thunder-far'; shake: boolean } {
  return { sound: close ? 'thunder-close' : 'thunder-far', shake: close && thunderShakes(settings) }
}

/**
 * Play one thunder: the caption and the sound go out together through emitCombatSound (sfx bus),
 * then the shake kick is called if allowed. The caption and shake never depend on an audio
 * context, so a silent device still gets both. Pausing does not cut the voice: it is a one-shot
 * that ends on its own, so a thunder already sounding finishes its tail.
 */
export function playThunder(close: boolean, settings: ThunderSettings, kick: () => void): void {
  const r = thunderResponse(close, settings)
  emitCombatSound(r.sound)
  if (r.shake) kick()
}
