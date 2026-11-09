// Combat sound emitter (Req 6.8, 21.6, 22.1, 22.5). Game code announces a sound here; the caption
// is raised from the data table and a registered listener (the audio layer) plays it. src/game
// never imports Howler, and a silent device or a missing listener still shows the caption.
import { CAPTIONS, type CaptionDef, type CaptionEvent, type CaptionId } from '../../data/captions'
import { emit } from '../events'

export type CombatSoundId = CaptionEvent

export interface SoundPosition {
  x: number
  y: number
  z: number
}

export type CombatSoundListener = (id: CombatSoundId, at?: SoundPosition) => void

let listener: CombatSoundListener | null = null

/** Register the audio layer's player. Pass null to remove it. */
export function setCombatSoundListener(fn: CombatSoundListener | null): void {
  listener = fn
}

/**
 * Raise the caption(s) for a sound, then hand it to the listener. `captionId` picks one caption
 * when several share a sound (board-break has a front-door and a vestry line).
 */
export function emitCombatSound(id: CombatSoundId, at?: SoundPosition, captionId?: CaptionId): void {
  const captions: CaptionDef[] = CAPTIONS.filter(
    (c) => c.event === id && (captionId === undefined || c.id === captionId),
  )
  // Captions first so a throwing audio listener can never swallow them.
  const chosen = captionId === undefined ? captions.slice(0, 1) : captions
  for (const c of chosen) {
    emit({ type: 'subtitleShown', text: c.text, duration: c.minSeconds })
  }
  listener?.(id, at)
}
