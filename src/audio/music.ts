// Procedural music graph (spec 08 Req 9). Stems and a master gain sit on the 07 music bus
// (`SynthEngine.music`), which already carries music setting x master setting (volumes.ts), so
// nothing here reads settings. The stems are procedural oscillators; no file is loaded.
import { SYNTH_MUSIC } from '../data/music'
import type { Weights } from '../game/systems/musicMixer'
import { getSynth, type SynthEngine } from './synth'

export interface MusicGraph {
  ctx: AudioContext
  /** Drone, unease, tension, danger. */
  stems: readonly [GainNode, GainNode, GainNode, GainNode]
  master: GainNode
  /** Next time (context seconds) a heartbeat pair is due. */
  nextBeatAt: number
}

let graph: MusicGraph | null = null

/** Build the stems (oscillators, filters, LFOs) and master on the music bus. Built once; never torn down. */
export function createMusicGraph(engine: SynthEngine): MusicGraph {
  if (graph && graph.ctx === engine.ctx) return graph
  const { ctx } = engine
  const S = SYNTH_MUSIC
  const master = ctx.createGain()
  master.gain.value = 0
  master.connect(engine.music)
  const make = (): GainNode => {
    const g = ctx.createGain()
    g.gain.value = 0
    g.connect(master)
    return g
  }
  const stems: [GainNode, GainNode, GainNode, GainNode] = [make(), make(), make(), make()]

  const osc = (type: OscillatorType, hz: number, to: AudioNode): OscillatorNode => {
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.value = hz
    o.connect(to)
    o.start()
    return o
  }
  const lowpass = (hz: number, to: AudioNode): BiquadFilterNode => {
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = hz
    f.connect(to)
    return f
  }
  /** A slow sine LFO that adds `depth` to `param` around its base value. */
  const lfo = (hz: number, depth: number, param: AudioParam): void => {
    const g = ctx.createGain()
    g.gain.value = depth
    g.connect(param)
    osc('sine', hz, g)
  }

  // Drone: sine + triangle through a low-pass, with a slow swell on the stem's own gain.
  const droneLp = lowpass(S.drone.lowpassHz, stems[0])
  osc('sine', S.drone.sineHz, droneLp)
  osc('triangle', S.drone.triangleHz, droneLp)
  const droneSwell = ctx.createGain()
  droneSwell.gain.value = 0.15
  droneSwell.connect(droneLp.frequency)
  osc('sine', S.drone.lfoHz, droneSwell)

  // Unease: detuned sine plus a pulsing octave-and-a-bit above.
  const uneaseLp = lowpass(S.unease.lowpassHz, stems[1])
  const uneaseMix = ctx.createGain()
  uneaseMix.gain.value = 0.7
  uneaseMix.connect(uneaseLp)
  osc('sine', S.unease.detunedSineHz, uneaseMix)
  const pulse = ctx.createGain()
  pulse.gain.value = 0.5
  pulse.connect(uneaseMix)
  osc('sine', S.unease.pulseSineHz, pulse)
  lfo(S.unease.pulseLfoHz, 0.5, pulse.gain)

  // Tension: three saws through a moving low-pass and a pulsing gain.
  const tensionPulse = ctx.createGain()
  tensionPulse.gain.value = 0.6
  tensionPulse.connect(stems[2])
  lfo(S.tension.pulseLfoHz, 0.4, tensionPulse.gain)
  const tensionLp = lowpass(S.tension.lowpassHz, tensionPulse)
  lfo(S.tension.filterLfoHz, 400, tensionLp.frequency)
  for (const hz of S.tension.sawHz) osc('sawtooth', hz, tensionLp)

  // Danger: a sub sine; the heartbeat thuds are scheduled onto this stem.
  osc('sine', S.danger.subHz, stems[3])

  graph = { ctx, master, stems, nextBeatAt: 0 }
  return graph
}

/** One heartbeat thud: a short falling sine on the danger stem. */
function thud(g: MusicGraph, at: number, peak: number): void {
  const { ctx } = g
  const o = ctx.createOscillator()
  const env = ctx.createGain()
  o.type = 'sine'
  o.frequency.setValueAtTime(70, at)
  o.frequency.exponentialRampToValueAtTime(38, at + 0.15)
  env.gain.setValueAtTime(0, at)
  env.gain.linearRampToValueAtTime(peak, at + 0.02)
  env.gain.exponentialRampToValueAtTime(0.0001, at + 0.2)
  o.connect(env)
  env.connect(g.stems[3])
  o.start(at)
  o.stop(at + 0.25)
}

/**
 * Schedule heartbeat pairs that fall inside the look-ahead window. Only runs while the danger
 * stem is audible, so a quiet danger stem costs nothing and never queues stale thuds.
 */
export function scheduleHeartbeat(g: MusicGraph, dangerLevel: number): void {
  const hb = SYNTH_MUSIC.heartbeat
  const now = g.ctx.currentTime
  if (dangerLevel <= hb.activeAbove) {
    g.nextBeatAt = 0
    return
  }
  if (g.nextBeatAt < now) g.nextBeatAt = now
  while (g.nextBeatAt < now + hb.lookAheadS) {
    thud(g, g.nextBeatAt, 1)
    thud(g, g.nextBeatAt + hb.thudGapS, 0.7)
    g.nextBeatAt += hb.periodS
  }
}
const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0)

function smoothTo(node: GainNode, value: number, ctx: AudioContext): void {
  const now = ctx.currentTime
  node.gain.cancelScheduledValues(now)
  node.gain.setTargetAtTime(value, now, SYNTH_MUSIC.smoothingS)
}

/** Write stem weights (scaled by each stem's peak) and master, smoothed so fades never click. */
export function setMusicLevels(g: MusicGraph, stems: Weights, master: number): void {
  g.stems.forEach((node, i) =>
    smoothTo(node, clamp01(stems[i] ?? 0) * SYNTH_MUSIC.stemPeaks[i], g.ctx),
  )
  smoothTo(g.master, clamp01(master), g.ctx)
}

/**
 * One frame: silent until audio is unlocked and the context is running, then build the graph
 * (once) and follow the runtime. Returns whether music is live.
 */
export function stepMusic(levels: { stems: Weights; master: number; frozen?: boolean }): boolean {
  try {
    const engine = getSynth()
    if (!engine || engine.ctx.state !== 'running') return false
    const g = createMusicGraph(engine)
    setMusicLevels(g, levels.stems, levels.master)
    if (!levels.frozen) scheduleHeartbeat(g, clamp01(levels.stems[3] ?? 0))
    return true
  } catch {
    return false
  }
}

/** Test hook: forget the singleton graph. */
export function resetMusicForTests(): void {
  graph = null
}
