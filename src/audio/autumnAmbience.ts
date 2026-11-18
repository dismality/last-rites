// Autumn ambience (design bible §15): a wind bed through the bare branches, crows by day and a
// far-off bell tolling for All Souls at night. The wind plays ambience/wind-night.ogg when it is
// there and a low band of filtered noise until then; crows and the bell are recorded only and
// stay silent until their files exist. Every call is safe with no audio context.

import { AUTUMN_AMBIENCE, AUTUMN_SOUNDS } from '../data/allHallows'
import { isAudioEnabled } from './audioEnabled'
import { playRecorded } from './AudioManager'
import { sampleBuffer } from './samples'
import { getSynth, type SynthEngine } from './synth'

interface WindGraph {
  engine: SynthEngine
  source: AudioBufferSourceNode
  gain: GainNode
  file: boolean
}

let graph: WindGraph | null = null
let lastTarget = -1

function buildGraph(engine: SynthEngine): WindGraph | null {
  try {
    const { ctx } = engine
    const recorded = sampleBuffer(AUTUMN_SOUNDS.wind)
    const source = ctx.createBufferSource()
    source.buffer = recorded ?? engine.noiseBuffer()
    source.loop = true
    const gain = ctx.createGain()
    gain.gain.value = 0
    if (recorded) {
      source.connect(gain)
    } else {
      const lowpass = ctx.createBiquadFilter()
      lowpass.type = 'lowpass'
      lowpass.frequency.value = AUTUMN_AMBIENCE.windNoise.lowpassHz
      source.connect(lowpass)
      lowpass.connect(gain)
    }
    gain.connect(engine.ambience)
    source.start()
    return { engine, source, gain, file: recorded !== null }
  } catch {
    return null
  }
}

function dropGraph(): void {
  try {
    graph?.source.stop()
    graph?.gain.disconnect()
  } catch {
    // already stopped
  }
  graph = null
  lastTarget = -1
}

function ensureGraph(): WindGraph | null {
  const engine = getSynth()
  if (!engine) return null
  // A wind file that finished decoding after the noise started takes over from it.
  const upgrade = graph !== null && graph.engine === engine && !graph.file && sampleBuffer(AUTUMN_SOUNDS.wind) !== null
  if (graph && graph.engine === engine && !upgrade) return graph
  dropGraph()
  graph = buildGraph(engine)
  return graph
}

/**
 * Set the wind bed: `level` 0..1 from the phase, `swell` 0..1 for the slow gusting. Frozen (menus,
 * pause) mutes it. Called every frame by the scene.
 */
export function setWindBed(level: number, swell: number, frozen: boolean): void {
  if (!isAudioEnabled()) return
  const lvl = Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : 0
  const sw = Number.isFinite(swell) ? Math.min(1, Math.max(0, swell)) : 0
  const base = frozen ? 0 : lvl
  if (base === 0 && !graph) return
  const g = ensureGraph()
  if (!g) return
  const N = AUTUMN_AMBIENCE.windNoise
  const shaped = g.file ? base * AUTUMN_AMBIENCE.windFileGain : base * N.gain
  const target = Math.round(shaped * (1 - N.swell / 2 + N.swell * sw) * 1000) / 1000
  if (target === lastTarget) return
  try {
    const param = g.gain.gain
    const now = g.engine.ctx.currentTime
    param.cancelScheduledValues(now)
    param.setValueAtTime(param.value, now)
    param.linearRampToValueAtTime(target, now + (frozen ? 0.3 : 0.5))
    lastTarget = target
  } catch {
    // never let sound break the game loop
  }
}

/** A crow from somewhere in the trees, `distanceM` away at `angle` around the listener. */
export function playCrow(listenerX: number, listenerZ: number, angle: number, distanceM: number): void {
  playRecorded(
    AUTUMN_SOUNDS.crow,
    { x: listenerX + Math.cos(angle) * distanceM, y: 6, z: listenerZ + Math.sin(angle) * distanceM },
    AUTUMN_AMBIENCE.crowVolume,
    60,
    'ambience',
  )
}

/** One toll of the far-off village bell. */
export function playAllSoulsBell(): void {
  const [x, y, z] = AUTUMN_AMBIENCE.bellPosition
  playRecorded(AUTUMN_SOUNDS.bell, { x, y, z }, AUTUMN_AMBIENCE.bellVolume, AUTUMN_AMBIENCE.bellMaxDistanceM, 'ambience')
}

/** Test hook: drop the wind graph and forget the last level. */
export function resetAutumnAmbienceForTests(): void {
  dropGraph()
}
