// The per-frame driver of a screen jumpscare (spec 11 H1), split out of ScreenScare.tsx so the
// timing and the sting depend on the scare alone and never on what stands on screen: a face image
// and the flickering hand-drawn stand-in that replaces it when the file is missing are driven
// by the very same code (Req 1.20, 8.16). It only writes `style` on the elements it is handed.
import {
  releaseScreenScareDuck,
  startScreenScareAudio,
  stopScreenScareAudio,
} from '../../audio/screenScareAudio'
import { SCARE_FLICKER, SCARE_SETS } from '../../data/screenScares'
import { isSimFrozen } from '../../game/state/menuState'
import { endScreenScare } from '../../game/state/screenScareActions'
import { resetScreenScareRuntime, screenScareRuntime } from '../../game/state/screenScareStore'
import { simClock } from '../../game/state/simClock'
import {
  flickerFrame,
  jitterScale,
  phaseAt,
  phaseProgress,
  timelineLengthMs,
  worldBrightnessAt,
  type ActiveScare,
} from '../../game/systems/screenScares'
import { scareRuntime } from '../../scene/scares/scareRuntime'

const STEP_MS = 1000 / 60
/** How far the face slides back toward its edge while it fades out (a share of its own height). */
const OUT_SLIDE = 0.35
const CHROMA_PX = 5

/** The part of an element the driver touches. */
export interface StyledElement {
  style: { transform: string; opacity: string; filter: string }
  /** The flicker face reads `data-frame` to pick which lit frame shows. */
  dataset?: { frame?: string }
}

export interface FlashElement {
  style: { opacity: string }
}

export interface ScareDriverDeps {
  startAudio: (stingGain: number) => void
  stopAudio: () => void
  releaseDuck: () => void
  reducedMotion: () => boolean
  raf: (cb: () => void) => number
  cancelRaf: (id: number) => void
  now: () => number
}

const realDeps = (): ScareDriverDeps => ({
  startAudio: startScreenScareAudio,
  stopAudio: stopScreenScareAudio,
  releaseDuck: releaseScreenScareDuck,
  reducedMotion: () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  raf: (cb) => requestAnimationFrame(cb),
  cancelRaf: (id) => cancelAnimationFrame(id),
  now: () => performance.now(),
})

/** A smooth 0..1 wobble of time, so the jitter is steady between runs and needs no random source. */
const noise01 = (tMs: number): number => 0.5 + 0.5 * Math.sin(tMs * 0.09 + Math.sin(tMs * 0.031) * 3)

/**
 * Starts the sting and the frame loop for `scare`. `getFace` and `getFlash` are read every frame,
 * so the face element may be swapped (image to placeholder) mid-scare without touching the timing.
 * Returns the cleanup.
 */
export function driveScreenScare(
  scare: ActiveScare,
  getFace: () => StyledElement | null,
  getFlash: () => FlashElement | null,
  overrides: Partial<ScareDriverDeps> = {},
): () => void {
  const deps = { ...realDeps(), ...overrides }
  const { timeline, fx } = scare
  const edge = SCARE_SETS[scare.set].edge
  const slide = !deps.reducedMotion()
  const off = edge === 'bottom' ? 1 : -1
  let raf = 0
  let lastSim = simClock.now
  let lastPerf = deps.now()
  let shook = false
  let ducked = false
  let audioOn = false
  let finished = false
  let naturalEnd = false

  // Sim time of the scare in ms. The sim clock moves in 1/60 s steps, so between steps the
  // render clock adds the time since the last step (at most one step), unless the sim is frozen.
  const sample = (): number => {
    const perf = deps.now()
    if (simClock.now !== lastSim) {
      lastSim = simClock.now
      lastPerf = perf
    }
    const extra = isSimFrozen() ? 0 : Math.min(perf - lastPerf, STEP_MS)
    return (simClock.now - scare.startSim) * 1000 + extra
  }

  deps.startAudio(fx.stingGain)
  audioOn = fx.stingGain > 0
  ducked = audioOn
  const flash = getFlash()
  if (fx.flash && flash) {
    flash.style.opacity = '1'
    // One frame, then gone.
    deps.raf(() => {
      const f = getFlash()
      if (f) f.style.opacity = '0'
    })
  }

  const frame = (): void => {
    if (finished) return
    const frozen = isSimFrozen()
    // Paused: the timeline is already still; cut the voice and end the duck, and do not replay it.
    if (frozen && audioOn) {
      deps.stopAudio()
      audioOn = false
      ducked = false
    }
    const t = Math.max(0, sample())
    const phase = phaseAt(timeline, t)
    screenScareRuntime.brightness = worldBrightnessAt(timeline, t, fx.dim)

    if (phase === 'hold' && !shook) {
      shook = true
      // The existing camera shake channel; the controller still applies Camera shake and Scare intensity.
      if (fx.shake) scareRuntime.shakeAge = 0
    }
    if ((phase === 'out' || phase === 'done') && ducked) {
      ducked = false
      deps.releaseDuck()
    }

    const face = getFace()
    if (face) {
      const p = phaseProgress(timeline, t)
      let y = 0
      let scale = 1
      let opacity = 1
      let filter = 'none'
      if (phase === 'in') {
        y = slide ? off * (1 - p) : 0
        opacity = slide ? 1 : p
      } else if (phase === 'hold') {
        scale = fx.jitter ? jitterScale(noise01(t)) : 1
        if (fx.chromatic) {
          filter = `drop-shadow(${-CHROMA_PX}px 0 0 rgba(255,40,40,0.65)) drop-shadow(${CHROMA_PX}px 0 0 rgba(40,220,255,0.55))`
        }
      } else if (phase === 'out') {
        y = slide ? off * OUT_SLIDE * p : 0
        opacity = 1 - p
      } else {
        opacity = 0
      }
      face.style.transform = `translate(-50%, ${y * 100}%) scale(${scale})`
      face.style.opacity = String(opacity)
      face.style.filter = filter
      // Sim time drives the frame too, so a paused scare holds still on one frame.
      if (face.dataset) {
        face.dataset.frame = String(flickerFrame(t, SCARE_FLICKER.sequence, SCARE_FLICKER.frameMs, fx.chromatic))
      }
    }

    if (phase === 'done' || t >= timelineLengthMs(timeline)) {
      finished = true
      naturalEnd = true
      endScreenScare()
      return
    }
    raf = deps.raf(frame)
  }
  raf = deps.raf(frame)

  return () => {
    finished = true
    deps.cancelRaf(raf)
    // A scare that ran out lets the sting's tail ring; one cut short (new run, Retry, the HUD
    // unmounting) silences it.
    if (naturalEnd) deps.releaseDuck()
    else deps.stopAudio()
    resetScreenScareRuntime()
  }
}
