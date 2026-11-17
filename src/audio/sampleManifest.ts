// Recorded audio files: which ones exist and which name each answers to. Pure, no Web Audio.
//
// Files live in public/assets/audio/<folder>/<name>.ogg (folders: sfx, voice, music, ambience).
// The dev server and the build list them in /assets/audio/manifest.json (the audio-manifest
// plugin in vite.config.ts), so dropping a file in is all it takes. A name ending in -N is a
// variant: "zombie-groan-1" .. "zombie-groan-4" all answer to "zombie-groan" (one picked at
// random), and each still answers to its own full name too.

/** Folders under public/assets/audio that hold playable files. */
export const AUDIO_FOLDERS = ['sfx', 'voice', 'music', 'ambience'] as const
export type AudioFolder = (typeof AUDIO_FOLDERS)[number]

/** File types the loader accepts. Ogg is the one the scripts make; the rest are for quick tests. */
export const AUDIO_EXTENSIONS = ['.ogg', '.mp3', '.wav', '.m4a'] as const

export const MANIFEST_FILE = 'manifest.json'

export interface SampleIndex {
  /** Name (with or without its -N) to the files that answer to it, relative to the audio folder. */
  readonly byName: ReadonlyMap<string, readonly string[]>
}

const VARIANT = /-(\d+)$/

/** "sfx/zombie-groan-2.ogg" -> "zombie-groan-2"; null for a path the loader ignores. */
export function sampleName(path: string): string | null {
  const clean = path.replace(/\\/g, '/')
  const slash = clean.indexOf('/')
  if (slash < 0) return null
  const folder = clean.slice(0, slash)
  if (!(AUDIO_FOLDERS as readonly string[]).includes(folder)) return null
  const file = clean.slice(slash + 1)
  if (file.includes('/')) return null
  const ext = AUDIO_EXTENSIONS.find((e) => file.toLowerCase().endsWith(e))
  if (!ext) return null
  const name = file.slice(0, -ext.length)
  return name.length > 0 ? name : null
}

/** Group the manifest's paths by the names they answer to. Unknown paths are skipped. */
export function indexSamples(paths: readonly string[]): SampleIndex {
  const byName = new Map<string, string[]>()
  const add = (name: string, path: string) => {
    const list = byName.get(name)
    if (list) {
      if (!list.includes(path)) list.push(path)
    } else byName.set(name, [path])
  }
  for (const raw of [...paths].sort()) {
    const path = raw.replace(/\\/g, '/')
    const name = sampleName(path)
    if (!name) continue
    add(name, path)
    const base = name.replace(VARIANT, '')
    if (base !== name && base.length > 0) add(base, path)
  }
  return { byName }
}

/** One file for a name, or null. `random` in [0, 1) picks among variants. */
export function pickSample(index: SampleIndex, name: string, random: number): string | null {
  const list = index.byName.get(name)
  if (!list || list.length === 0) return null
  const r = Number.isFinite(random) ? Math.min(Math.max(random, 0), 0.999999) : 0
  return list[Math.floor(r * list.length)] ?? null
}

/** Parse the manifest JSON (a plain array of paths). Anything else counts as no files. */
export function parseManifest(json: unknown): string[] {
  return Array.isArray(json) ? json.filter((p): p is string => typeof p === 'string') : []
}
