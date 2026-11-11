// Combat captions (Req 22.1, design bible §7 "Extra captions"). One entry per important
// combat sound. The queue in `src/game/systems/captions.ts` applies the 3-caption cap.

import type { SoundId } from './sounds'

/** Moments that have no synth voice but still caption: the boss's last words and spec 08 events. */
export const SILENT_CAPTION_EVENTS = [
  'boss-death',
  'merchant-arrive',
  'merchant-leave',
  'coins-collected',
  'contract-done',
  'achievement-unlocked',
] as const

export type SilentCaptionEvent = (typeof SILENT_CAPTION_EVENTS)[number]

/** A caption can also follow a moment that has no synth voice. */
export type CaptionEvent = SoundId | SilentCaptionEvent

export type CaptionId =
  | 'revolver-shot'
  | 'shotgun-blast'
  | 'dry-click'
  | 'reload'
  | 'weapon-break'
  | 'weapon-crack'
  | 'board-break-front'
  | 'board-break-vestry'
  | 'bloater-hiss'
  | 'bloater-burst'
  | 'brute-arrival'
  | 'elite-arrival'
  | 'boss-rise'
  | 'congregation'
  | 'toll'
  | 'boss-death'
  | 'thunder-close'
  | 'thunder-far'
  | 'merchant-arrive'
  | 'merchant-leave'
  | 'coins-collected'
  | 'contract-done'
  | 'achievement-unlocked'

export interface CaptionDef {
  id: CaptionId
  event: CaptionEvent
  /** For `template` captions the words N and NAME are filled in by the caller. */
  text: string
  template?: boolean
  /** Shortest time on screen. Never below the 1.5 s floor of Req 22.2. */
  minSeconds: number
}

export const CAPTION_MIN_SECONDS = 1.5
export const CAPTION_MAX_VISIBLE = 3

export const CAPTIONS: readonly CaptionDef[] = [
  { id: 'revolver-shot', event: 'revolver-shot', text: '[a gunshot]', minSeconds: 1.5 },
  { id: 'shotgun-blast', event: 'shotgun-blast', text: '[a shotgun blast]', minSeconds: 1.5 },
  { id: 'dry-click', event: 'dry-click', text: '[click]', minSeconds: 1.5 },
  { id: 'reload', event: 'reload', text: '[reloading]', minSeconds: 1.5 },
  {
    id: 'weapon-break',
    event: 'weapon-break',
    text: '[the axe handle splinters]',
    minSeconds: 1.5,
  },
  {
    id: 'weapon-crack',
    event: 'weapon-crack',
    text: 'NAME is cracking',
    template: true,
    minSeconds: 2,
  },
  {
    id: 'board-break-front',
    event: 'board-break',
    text: '[wood splinters at the front door]',
    minSeconds: 1.5,
  },
  {
    id: 'board-break-vestry',
    event: 'board-break',
    text: '[wood splinters at the vestry door]',
    minSeconds: 1.5,
  },
  { id: 'bloater-hiss', event: 'bloater-hiss', text: '[a wet hiss]', minSeconds: 1.5 },
  { id: 'bloater-burst', event: 'bloater-burst', text: '[a wet burst]', minSeconds: 1.5 },
  { id: 'brute-arrival', event: 'brute-grunt', text: '[heavy footsteps]', minSeconds: 1.5 },
  { id: 'elite-arrival', event: 'elite-arrival', text: '[something worse rises]', minSeconds: 3 },
  {
    id: 'boss-rise',
    event: 'boss-rise',
    text: '[stone grinding beneath the altar]',
    minSeconds: 2,
  },
  {
    id: 'congregation',
    event: 'congregation',
    text: '[dead shuffle rising from the floor]',
    minSeconds: 1.5,
  },
  { id: 'toll', event: 'toll', text: '[a great bell tolls]', minSeconds: 2.5 },
  { id: 'boss-death', event: 'boss-death', text: 'Forgive them. Not me.', minSeconds: 3 },
  // Spec 08. Thunder lasts a few seconds, so its caption stays 3 s (Req 10.9).
  { id: 'thunder-close', event: 'thunder-close', text: '[thunder]', minSeconds: 3 },
  { id: 'thunder-far', event: 'thunder-far', text: '[thunder]', minSeconds: 3 },
  {
    id: 'merchant-arrive',
    event: 'merchant-arrive',
    text: '[a hearse cart creaks to the gate]',
    minSeconds: 2.5,
  },
  {
    id: 'merchant-leave',
    event: 'merchant-leave',
    text: '[the hearse cart rolls away]',
    minSeconds: 2.5,
  },
  {
    id: 'coins-collected',
    event: 'coins-collected',
    text: '[+N grave coins]',
    template: true,
    minSeconds: 1.5,
  },
  {
    id: 'contract-done',
    event: 'contract-done',
    text: '[contract done: NAME]',
    template: true,
    minSeconds: 3,
  },
  {
    id: 'achievement-unlocked',
    event: 'achievement-unlocked',
    text: '[achievement: NAME]',
    template: true,
    minSeconds: 3,
  },
]

export const CAPTION_MAP: Readonly<Record<CaptionId, CaptionDef>> = Object.fromEntries(
  CAPTIONS.map((c) => [c.id, c]),
) as Record<CaptionId, CaptionDef>
