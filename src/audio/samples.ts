// Recorded audio files on top of the procedural sounds. Once audio is unlocked, the manifest is
// fetched and every listed file is decoded in the background. A sound plays from its file when
// one is decoded, and otherwise falls back to its synth recipe (or stays silent if it has none),
// so files can be added a few at a time. Never throws: a missing manifest, a 404 or a file the
// browser can't decode just means that sound keeps its fallback.
//
// No runtime import of synth.ts (it imports this file): the engine is passed in.

import type { SoundPosition, SynthEngine, Voice } from './synth'
import { indexSamples, MANIFEST_FILE, parseManifest, pickSample, type SampleIndex } from './sampleManifest'

const EMPTY: SampleIndex = { byName: new Map() }

let index: SampleIndex = EMPTY
const buffers = new Map<string, AudioBuffer>()
const pending = new Map<string, Promise<AudioBuffer | null>>()
let loaded: Promise<void> | null = null
let random: () => number = Math.random

/** Where public/assets/audio is served from, with a trailing slash. */
export function audioBaseUrl(): string {
  const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'
  return `${base.endsWith('/') ? base : `${base}/`}assets/audio/`
}

type FetchLike = (url: string) => Promise<{ ok: boolean; json(): Promise<unknown>; arrayBuffer(): Promise<ArrayBuffer> }>

const defaultFetch: FetchLike = (url) => fetch(url)

function decode(engine: SynthEngine, path: string, fetchFn: FetchLike): Promise<AudioBuffer | null> {
  const known = buffers.get(path)
  if (known) return Promise.resolve(known)
  const inFlight = pending.get(path)
  if (inFlight) return inFlight
  const job = (async () => {
    try {
      const res = await fetchFn(`${audioBaseUrl()}${path}`)
      if (!res.ok) return null
      const data = await res.arrayBuffer()
      const buffer = await engine.ctx.decodeAudioData(data)
      buffers.set(path, buffer)
      return buffer
    } catch {
      return null
    } finally {
      pending.delete(path)
    }
  })()
  pending.set(path, job)
  return job
}

/**
 * Fetch the manifest and decode every listed file. Safe to call again: the first call's promise
 * is reused. Music files are listed but decoded only when asked for, as they are large.
 */
export function loadSamples(engine: SynthEngine, fetchFn: FetchLike = defaultFetch): Promise<void> {
  if (loaded) return loaded
  loaded = (async () => {
    try {
      const res = await fetchFn(`${audioBaseUrl()}${MANIFEST_FILE}`)
      if (!res.ok) return
      const paths = parseManifest(await res.json())
      index = indexSamples(paths)
      await Promise.all(paths.filter((p) => !p.startsWith('music/')).map((p) => decode(engine, p, fetchFn)))
    } catch {
      // no manifest: every sound keeps its fallback
    }
  })()
  return loaded
}

/** True when at least one file answers to `name` (decoded or not). */
export function hasSample(name: string): boolean {
  return index.byName.has(name)
}

/** A decoded file for `name` (a random variant), or null when none is ready yet. */
export function sampleBuffer(name: string): AudioBuffer | null {
  const path = pickSample(index, name, random())
  return path ? (buffers.get(path) ?? null) : null
}

/**
 * Play a recording for `name` if one is decoded. Returns its stop handle, or null when the caller
 * should fall back (no file, still decoding, or Web Audio refused).
 */
export function playSample(
  engine: SynthEngine,
  name: string,
  at?: SoundPosition,
  volume = 1,
  maxDistanceM = 40,
  direct = false,
): Voice | null {
  try {
    const buffer = sampleBuffer(name)
    if (!buffer) return null
    return engine.playBuffer(buffer, at, volume, maxDistanceM, direct)
  } catch {
    return null
  }
}

/** Test hook: install a file list without fetching. */
export function setSampleIndexForTests(paths: readonly string[]): void {
  index = indexSamples(paths)
}

/** Test hook: mark a file as decoded. */
export function setSampleBufferForTests(path: string, buffer: AudioBuffer): void {
  buffers.set(path, buffer)
}

/** Test hook: replace the variant picker (returns [0, 1)). Pass null to restore. */
export function setSampleRandomForTests(fn: (() => number) | null): void {
  random = fn ?? Math.random
}

/** Test hook: forget every file and the manifest. */
export function resetSamplesForTests(): void {
  index = EMPTY
  buffers.clear()
  pending.clear()
  loaded = null
  random = Math.random
}
