export interface AudioEntry {
  kind: 'sfx' | 'voice' | 'music'
  folder: 'sfx' | 'voice' | 'music' | 'ambience'
  name: string
  prompt?: string
  text?: string
  voice?: 'narrator' | 'elias' | 'dead' | 'keeper'
  seconds?: number
  loop?: boolean
  variants?: number
  wired?: boolean
  batch?: string
  source?: string
  note?: string
}
export const SFX_STYLE: string
export const VOICES: Record<'narrator' | 'elias' | 'dead' | 'keeper', { describe: string; env: string; fallbackId: string }>
export const AUDIO: readonly AudioEntry[]
export function inBatch(entry: AudioEntry, batch: string): boolean
export function fileNames(entry: AudioEntry): string[]
