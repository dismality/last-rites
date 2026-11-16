// Win cutscene maths (spec 10 task 6, Req 23): after the Stage 3 sunrise the keeper walks the main
// path south and out of the cemetery gates while the sun rises and the fog lifts. Pure: the pose,
// bob, captions, gate swing and sky. The data is in data/winCutscene.ts; the scene
// (WinCutscene.tsx) turns this into a pose. The clock, fades, lines and camera easing reuse
// endingSequence.ts (Req 23.2).

import type { EndingLine } from '../../data/endings'
import { SUNRISE_LOOK, WIN_GATE, WIN_SEQUENCE, WIN_SEQUENCE_STILL, WIN_SUN, type WinSequenceDef } from '../../data/winCutscene'
import { samplePath } from './cameraPath'
import { cameraProgress, easeInOut } from './endingSequence'
import { hexToRgb, lerp, lerpRgb, type SkyBlend } from './skyTransition'

type Vec3 = readonly [number, number, number]

export function winSequenceFor(reducedMotion: boolean, cameraShake: boolean): WinSequenceDef {
  return reducedMotion || !cameraShake ? WIN_SEQUENCE_STILL : WIN_SEQUENCE
}

/** Where Space or Enter take the player (Req 23.3): the ending card and run summary. */
export const WIN_SKIP_TARGET = 'summary' as const

/** Camera position and look target at time `t` (the endings' easing, so it starts and stops softly). */
export function winPose(def: WinSequenceDef, t: number): { position: Vec3; target: Vec3 } {
  const u = cameraProgress(def, t)
  const position = samplePath(def.camera.position, u)
  const target = samplePath(def.camera.target, u)
  const [bx, by] = walkBob(def, t)
  return { position: [position[0] + bx, position[1] + by, position[2]], target }
}

/**
 * Walking bob [sway x, lift y] at time `t`: two lifts per stride, one sway, both faded in and out
 * with the walking speed so the camera is still at both ends. [0, 0] for the steady dolly.
 */
export function walkBob(def: WinSequenceDef, t: number): readonly [number, number] {
  if (!def.bob) return [0, 0]
  const k = Math.min(Math.max(t / def.duration, 0), 1)
  // Speed of the eased walk, normalised to 1 at the middle (smoothstep's slope is 6k(1-k), 1.5 there).
  const speed = 4 * k * (1 - k)
  const half = Math.PI * def.bob.stepsPerS * t
  return [Math.sin(half) * def.bob.sway * speed, Math.abs(Math.sin(half)) * def.bob.lift * speed]
}

/** 0 at the start of the walk, 1 at the end: how far the sun has risen. */
export const sunProgress = (def: WinSequenceDef, t: number): number => easeInOut(t / def.duration)

/** Height of the sun disc when it has risen by `k` (0..1). */
export const sunHeight = (k: number): number => lerp(WIN_SUN.fromY, WIN_SUN.toY, Math.min(Math.max(k, 0), 1))

/** The sound caption at time `t`, or null. */
export function activeCaption(def: WinSequenceDef, t: number): EndingLine | null {
  return def.captions.find((c) => t >= c.at && t < c.at + c.hold) ?? null
}

/** Seconds in when the camera reaches the gate line (the first sample at or past it). */
export function gateTime(def: WinSequenceDef, step: number = WIN_GATE.sampleStepS): number {
  const steady = { ...def, bob: null }
  for (let i = 0; i * step <= def.duration; i++) {
    if (winPose(steady, i * step).position[2] >= WIN_GATE.z) return i * step
  }
  return def.duration
}

/** Gate leaf angle (0 shut, WIN_GATE.openAngle open): it swings open just before the keeper reaches it. */
export function gateOpenAngle(def: WinSequenceDef, t: number, atGate = gateTime(def)): number {
  const k = Math.min(Math.max((t - (atGate - WIN_GATE.swingLeadS)) / WIN_GATE.swingS, 0), 1)
  return easeInOut(k) * WIN_GATE.openAngle
}

/** The sky for this frame: the phase blend carried toward sunrise by `k` (0..1). Fog lifts with it. */
export function winSkyBlend(base: SkyBlend, k: number): SkyBlend {
  const c = Math.min(Math.max(k, 0), 1)
  return {
    sky: lerpRgb(base.sky, hexToRgb(SUNRISE_LOOK.sky), c),
    ambientColor: lerpRgb(base.ambientColor, hexToRgb(SUNRISE_LOOK.ambientColor), c),
    ambientIntensity: lerp(base.ambientIntensity, SUNRISE_LOOK.ambientIntensity, c),
    moonIntensity: lerp(base.moonIntensity, SUNRISE_LOOK.moonIntensity, c),
    fogDensity: base.fogDensity * lerp(1, SUNRISE_LOOK.fogScale, c),
  }
}

/**
 * Keys during the walk: Space and Enter skip to the card (default cancelled, so Enter does not also
 * click the card's first button). Escape is left alone: it pauses (Req 23.4).
 */
export function handleWinKey(e: { key: string; preventDefault: () => void }, skip: () => void): boolean {
  if (e.key !== ' ' && e.key !== 'Enter') return false
  e.preventDefault()
  skip()
  return true
}
