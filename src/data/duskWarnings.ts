// Dusk warnings (playtest 11r, design bible §13): the day ends on a timer, so the graveyard says
// so twice before it does. A far bell two minutes out, the graves trembling half a minute out.
// Each warning plays an existing sound and shows its own subtitle.
import type { CaptionId } from './captions'
import type { SoundId } from './sounds'

export interface DuskWarningDef {
  id: 'dusk-toll' | 'dusk-tremble'
  /** Seconds of day left when it sounds. */
  leftS: number
  sound: SoundId
  caption: CaptionId
}

export const DUSK_WARNINGS: readonly DuskWarningDef[] = [
  { id: 'dusk-toll', leftS: 120, sound: 'toll', caption: 'dusk-toll' },
  { id: 'dusk-tremble', leftS: 30, sound: 'thunder-far', caption: 'dusk-tremble' },
]
