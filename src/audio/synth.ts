// Procedural sound core (Req 6.8, 23.7, 23.9). No audio files: every combat sound is built from
// noise and oscillator layers on Howler's shared AudioContext, routed through an `sfx` bus into
// `Howler.masterGain` so the master volume applies. Music (and its bus) shares the same context.
// Every public call is wrapped in try/catch: a device without Web Audio is silent, never broken.

import { Howl, Howler } from 'howler'
import { SOUND_RECIPES, type SoundId, type SoundRecipe } from '../data/sounds'
import { isAudioEnabled } from './audioEnabled'

/** Most voices alive at once; the oldest is cut when a new one would exceed this (Req 23.9). */
export const MAX_VOICES = 16

/** Seconds of the shared white-noise buffer. Layers loop it, so one second is plenty. */
const NOISE_SECONDS = 1

/** Level changes ramp over this long so a slider drag never clicks. */
const VOLUME_RAMP_S = 0.05

/** A 1-sample silent WAV; the primer Howl needs a valid source to construct. */
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQIAAAAAAA=='

interface Voice {
  stop: () => void
}

export interface SoundPosition {
  x: number
  y: number
  z: number
}

export class SynthEngine {
  readonly sfx: GainNode
  readonly music: GainNode
  private voices: Voice[] = []
  private noise: AudioBuffer | null = null

  constructor(
    readonly ctx: AudioContext,
    destination: AudioNode,
  ) {
    this.sfx = ctx.createGain()
    this.music = ctx.createGain()
    this.sfx.connect(destination)
    this.music.connect(destination)
  }

  get voiceCount(): number {
    return this.voices.length
  }

  /** The one noise buffer every noise layer reads from. Built on first use, then shared. */
  noiseBuffer(): AudioBuffer {
    if (this.noise) return this.noise
    const { ctx } = this
    const length = Math.max(1, Math.floor(ctx.sampleRate * NOISE_SECONDS))
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
    this.noise = buffer
    return buffer
  }

  /** Smoothly set a bus level (0..1). */
  setBusGain(bus: 'sfx' | 'music', value: number): void {
    const node = bus === 'sfx' ? this.sfx : this.music
    const v = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
    const now = this.ctx.currentTime
    node.gain.cancelScheduledValues(now)
    node.gain.setTargetAtTime(v, now, VOLUME_RAMP_S)
  }

  /** Cut the oldest voices until there is room for one more. */
  private makeRoom(): void {
    while (this.voices.length >= MAX_VOICES) {
      const oldest = this.voices.shift()
      oldest?.stop()
    }
  }

  play(id: SoundId, at?: SoundPosition, volume = 1): boolean {
    const recipe: SoundRecipe | undefined = SOUND_RECIPES[id]
    if (!recipe) return false
    this.makeRoom()
    const { ctx } = this
    const t0 = ctx.currentTime
    const end = t0 + recipe.attackS + recipe.decayS

    const envelope = ctx.createGain()
    envelope.gain.setValueAtTime(0, t0)
    envelope.gain.linearRampToValueAtTime(Math.max(0, volume), t0 + recipe.attackS)
    envelope.gain.exponentialRampToValueAtTime(0.0001, end)

    let tail: AudioNode = envelope
    let panner: PannerNode | null = null
    if (recipe.spatial && at) {
      panner = ctx.createPanner()
      panner.panningModel = 'HRTF'
      panner.distanceModel = 'inverse'
      panner.maxDistance = recipe.maxDistanceM
      panner.positionX.value = at.x
      panner.positionY.value = at.y
      panner.positionZ.value = at.z
      envelope.connect(panner)
      tail = panner
    }
    tail.connect(this.sfx)

    const sources: AudioScheduledSourceNode[] = []
    const nodes: AudioNode[] = [envelope]
    if (panner) nodes.push(panner)

    for (const layer of recipe.layers) {
      const level = ctx.createGain()
      level.gain.value = layer.gain
      if (layer.kind === 'noise') {
        const src = ctx.createBufferSource()
        src.buffer = this.noiseBuffer()
        src.loop = true
        const filter = ctx.createBiquadFilter()
        filter.type = layer.filter
        filter.Q.value = layer.q
        filter.frequency.setValueAtTime(layer.fromHz, t0)
        filter.frequency.exponentialRampToValueAtTime(Math.max(1, layer.toHz), end)
        src.connect(filter)
        filter.connect(level)
        sources.push(src)
        nodes.push(filter)
      } else {
        const osc = ctx.createOscillator()
        osc.type = layer.wave
        osc.frequency.setValueAtTime(layer.fromHz, t0)
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, layer.toHz), end)
        osc.connect(level)
        sources.push(osc)
      }
      level.connect(envelope)
      nodes.push(level)
    }

    let stopped = false
    const voice: Voice = {
      stop: () => {
        if (stopped) return
        stopped = true
        for (const s of sources) {
          try {
            s.stop()
          } catch {
            // already stopped
          }
        }
        for (const n of nodes) {
          try {
            n.disconnect()
          } catch {
            // already disconnected
          }
        }
        const i = this.voices.indexOf(voice)
        if (i >= 0) this.voices.splice(i, 1)
      },
    }
    this.voices.push(voice)
    if (sources[0]) sources[0].onended = () => voice.stop()
    for (const s of sources) {
      s.start(t0)
      s.stop(end + 0.02)
    }
    return true
  }
}

let engine: SynthEngine | null = null
let primer: Howl | null = null

/**
 * Build the buses once Howler has made its context. Creating any Howl makes `Howler.ctx`, so a
 * silent, non-preloaded primer is enough; call this from the first user gesture (title click).
 */
export function unlockAudio(): SynthEngine | null {
  // Muted: never create a Howl, AudioContext use or buses, so music/rain/sfx all find no engine.
  if (!isAudioEnabled()) return null
  try {
    if (engine) {
      void engine.ctx.resume?.()
      return engine
    }
    if (!primer) primer = new Howl({ src: [SILENT_WAV], preload: false, volume: 0 })
    const ctx = Howler.ctx as AudioContext | null | undefined
    const master = Howler.masterGain as GainNode | null | undefined
    if (!ctx || !master) return null
    engine = new SynthEngine(ctx, master)
    void ctx.resume?.()
    return engine
  } catch {
    return null
  }
}

/** The engine if audio has been unlocked, else null. */
export function getSynth(): SynthEngine | null {
  return engine
}

/** Play a recipe. Safe to call before unlock, on a silent device, or with an unknown id. */
export function playSound(id: SoundId, at?: SoundPosition, volume = 1): void {
  if (!isAudioEnabled()) return
  try {
    engine?.play(id, at, volume)
  } catch {
    // never let sound break the game loop
  }
}

/** Test hook: drop the module singleton. */
export function resetSynthForTests(): void {
  engine = null
  primer = null
}

/** Test hook: install an engine built on a fake context. */
export function setSynthForTests(e: SynthEngine | null): void {
  engine = e
}
