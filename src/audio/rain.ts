// Rain noise bed (spec 08 Req 10.5, 10.11-10.13). The scene calls setRainLevel each frame with the
// visual rain level (0..1). A looped noise buffer runs through a high-pass and a band-pass into one
// gain node on the synth's sfx bus, so SFX and master volume apply with no extra wiring. Every call
// is safe with no audio context: the level is kept and the graph simply never builds.

import { RAIN_NOISE, STORM } from '../data/storms'
import { sampleBuffer } from './samples'
import { getSynth, type SynthEngine } from './synth'

/** Recorded rain loop (ambience/rain.ogg). When present it replaces the filtered noise. */
export const RAIN_FILE = 'rain'
/** The recording is already shaped, so it plays at this share of the noise bed's level. */
const RAIN_FILE_GAIN = 3

interface RainGraph {
  engine: SynthEngine
  source: AudioBufferSourceNode
  gain: GainNode
  /** Playing the recorded loop rather than the noise. */
  file: boolean
}

let level = 0
let frozen = false
let graph: RainGraph | null = null
let lastTarget = 0

const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0)

function buildGraph(engine: SynthEngine): RainGraph | null {
  try {
    const { ctx } = engine
    const recorded = sampleBuffer(RAIN_FILE)
    const source = ctx.createBufferSource()
    source.buffer = recorded ?? engine.noiseBuffer()
    source.loop = true
    const gain = ctx.createGain()
    gain.gain.value = 0
    if (recorded) {
      source.connect(gain)
    } else {
      const highpass = ctx.createBiquadFilter()
      highpass.type = 'highpass'
      highpass.frequency.value = RAIN_NOISE.highpassHz
      const bandpass = ctx.createBiquadFilter()
      bandpass.type = 'bandpass'
      bandpass.frequency.value = RAIN_NOISE.bandpassHz
      bandpass.Q.value = RAIN_NOISE.bandpassQ
      source.connect(highpass)
      highpass.connect(bandpass)
      bandpass.connect(gain)
    }
    gain.connect(engine.sfx)
    source.start()
    return { engine, source, gain, file: recorded !== null }
  } catch {
    return null
  }
}

/** The graph for the current engine, built on first need. Null when audio isn't unlocked. */
function ensureGraph(): RainGraph | null {
  const engine = getSynth()
  if (!engine) return null
  // A rain file that finished decoding after the noise bed started takes over from it.
  const upgrade = graph !== null && graph.engine === engine && !graph.file && sampleBuffer(RAIN_FILE) !== null
  if (graph && graph.engine === engine && !upgrade) return graph
  if (upgrade && graph) {
    try {
      graph.source.stop()
      graph.gain.disconnect()
    } catch {
      // already stopped
    }
  }
  graph = buildGraph(engine)
  lastTarget = 0
  return graph
}

function apply(): void {
  const base = frozen ? 0 : level * RAIN_NOISE.gain
  // Don't spin up a graph just to hold silence.
  if (base === 0 && !graph) return
  const g = ensureGraph()
  if (!g) return
  const target = Math.min(1, base * (g.file ? RAIN_FILE_GAIN : 1))
  if (target === lastTarget) return
  try {
    const param = g.gain.gain
    const now = g.engine.ctx.currentTime
    const from = param.value
    param.cancelScheduledValues(now)
    param.setValueAtTime(from, now)
    // Pausing mutes quickly; a storm starting or ending takes the full fade.
    const fadeS = frozen ? RAIN_NOISE.freezeFadeS : STORM.rainFadeS
    param.linearRampToValueAtTime(target, now + fadeS)
    lastTarget = target
  } catch {
    // never let sound break the game loop
  }
}

/** Set the rain loudness, 0 (silent) to 1 (full). Non-finite input counts as 0. */
export function setRainLevel(next: number): void {
  level = clamp01(next)
  apply()
}

/** Mute the bed while the simulation is frozen (pause, menus); it resumes on unfreeze. */
export function setRainFrozen(next: boolean): void {
  if (frozen === next) return
  frozen = next
  apply()
}

export function getRainLevel(): number {
  return level
}

/** Test hook: forget all state and drop the graph. */
export function resetRainForTests(): void {
  try {
    graph?.source.stop()
  } catch {
    // already stopped
  }
  graph = null
  level = 0
  frozen = false
  lastTarget = 0
}
