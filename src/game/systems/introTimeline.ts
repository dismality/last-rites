// Intro cutscene timeline: maps elapsed seconds to shot, camera pose, card and ink fade. Pure.

import type { Vec3 } from '../../data/cemeteryLayout'
import { INTRO_END_POSE, INTRO_FADE_S, INTRO_SHOTS, type IntroShot } from '../../data/introCutscene'
import { samplePath } from './cameraPath'

/** Card fade in/out length, inside its hold window. */
const CARD_FADE_S = 0.25

export interface IntroState {
  /** Zero-based index into the shots. */
  shot: number
  u: number
  position: Vec3
  target: Vec3
  card: { text: string; opacity: number } | null
  /** Ink opacity 0..1: ramps in over the first INTRO_FADE_S of a shot and out over the last. */
  fade: number
  done: boolean
}

export const introDuration = (shots: readonly IntroShot[] = INTRO_SHOTS): number =>
  shots.reduce((sum, s) => sum + s.duration, 0)

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x))

export const introStateAt = (t: number): IntroState => {
  const total = introDuration()
  const time = Number.isFinite(t) ? Math.min(total, Math.max(0, t)) : 0
  const done = time >= total

  let shot = 0
  let start = 0
  while (shot < INTRO_SHOTS.length - 1 && time >= start + INTRO_SHOTS[shot].duration) {
    start += INTRO_SHOTS[shot].duration
    shot += 1
  }
  const s = INTRO_SHOTS[shot]
  const local = Math.min(s.duration, time - start)
  const u = clamp01(local / s.duration)

  // The last shot ends clear: the player takes over from the bench view, not from black.
  const fadeIn = 1 - clamp01(local / INTRO_FADE_S)
  const fadeOut = shot === INTRO_SHOTS.length - 1 ? 0 : 1 - clamp01((s.duration - local) / INTRO_FADE_S)
  const fade = Math.max(fadeIn, fadeOut)

  const cardLocal = local - s.card.at
  let card: IntroState['card'] = null
  if (cardLocal >= 0 && cardLocal <= s.card.hold) {
    const opacity = clamp01(Math.min(cardLocal, s.card.hold - cardLocal) / CARD_FADE_S)
    card = { text: s.card.text, opacity }
  }

  return {
    shot,
    u,
    position: done ? INTRO_END_POSE.position : samplePath(s.camera.position, u),
    target: done ? INTRO_END_POSE.target : samplePath(s.camera.target, u),
    card,
    fade,
    done,
  }
}

/** Paused time does not advance, so the clock after resume equals the clock at pause. */
export const advanceIntro = (t: number, dt: number, paused: boolean): number =>
  paused ? t : Math.min(introDuration(), t + Math.max(0, dt))
