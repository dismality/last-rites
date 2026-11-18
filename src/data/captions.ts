// Combat captions (Req 22.1, design bible §7 "Extra captions"). One entry per important
// combat sound. The queue in `src/game/systems/captions.ts` applies the 3-caption cap.

import type { SoundId } from './sounds'
import { GRAB_CAPTION } from './killCam'

/** Moments that have no synth voice but still caption: the boss's last words and spec 08 events. */
export const SILENT_CAPTION_EVENTS = [
  'boss-death',
  'merchant-arrive',
  'merchant-leave',
  'coins-collected',
  'contract-done',
  'achievement-unlocked',
  // Spec 10: the altar's answers.
  'altar-wrong',
  'altar-locked',
  'altar-solved',
  // Spec 10 stage 3: the hymn board, the crypt pin and the rite.
  'hymn-tiles-wrong',
  'hymn-stair-open',
  'crypt-pin-pulled',
  'relic-placed',
  // Spec 11 H1: with Jumpscares off there is no face and no sting, only these 3 s subtitles.
  'screen-scare-off-zombie',
  'screen-scare-off-ghost',
] as const
// (pin-reached has a synth voice, so it is a SoundId, not a silent event.)

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
  | 'altar-wrong'
  | 'altar-locked'
  | 'altar-solved'
  | 'hymn-tiles-wrong'
  | 'hymn-stair-open'
  | 'crypt-pin-pulled'
  | 'relic-placed'
  | 'pin-reached'
  | 'grab-stinger'
  | 'grab-stinger-soft'
  | 'name-spoken'
  | 'vending-coin'
  | 'vending-handle'
  | 'vending-tray'
  | 'vending-refuse'
  | 'screen-scare-sting'
  | 'screen-scare-off-zombie'
  | 'screen-scare-off-ghost'
  | 'bat-chitter'
  | 'crawler-tell'
  | 'crawler-grab'
  | 'bride-tell'
  | 'bride-touch'
  | 'hound-tell'
  | 'hound-bite'

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
  // Spec 10. The wrong note is the bible's wording; the other two are chosen unattended.
  { id: 'altar-wrong', event: 'altar-wrong', text: '[a sour note from the altar]', minSeconds: 2 },
  { id: 'altar-locked', event: 'altar-locked', text: '[the altar is silent]', minSeconds: 2 },
  {
    id: 'altar-solved',
    event: 'altar-solved',
    text: '[a clear note from the altar]',
    minSeconds: 2.5,
  },
  // Spec 10 task 4.1: wording chosen unattended; the sour note above is the bible's.
  {
    id: 'hymn-tiles-wrong',
    event: 'hymn-tiles-wrong',
    text: '[brass tiles clatter]',
    minSeconds: 2,
  },
  {
    id: 'hymn-stair-open',
    event: 'hymn-stair-open',
    text: '[stone grinds behind the altar]',
    minSeconds: 3,
  },
  {
    id: 'crypt-pin-pulled',
    event: 'crypt-pin-pulled',
    text: '[an iron pin slides free]',
    minSeconds: 2.5,
  },
  { id: 'relic-placed', event: 'relic-placed', text: '[a low note from the altar]', minSeconds: 2 },
  // Spec 09 task 11l: the wording is the task's.
  { id: 'pin-reached', event: 'pin-reached', text: '[pin reached]', minSeconds: 1.5 },
  // Spec 10 task 8: the grab kill-cam, at Full and Reduced (Off shows the same words on its own).
  { id: 'grab-stinger', event: 'grab-stinger', text: GRAB_CAPTION, minSeconds: 1.5 },
  { id: 'grab-stinger-soft', event: 'grab-stinger-soft', text: GRAB_CAPTION, minSeconds: 1.5 },
  // Spec 10 task 11: Name the Dead.
  { id: 'name-spoken', event: 'name-spoken', text: '[a name, spoken: NAME]', template: true, minSeconds: 3 },
  // Spec 11 H6: the hut's vending machine.
  { id: 'vending-coin', event: 'vending-coin', text: '[a coin clinks into the machine]', minSeconds: 1.5 },
  { id: 'vending-handle', event: 'vending-handle', text: '[a brass handle clacks]', minSeconds: 1.5 },
  { id: 'vending-tray', event: 'vending-tray', text: '[something drops into the tray]', minSeconds: 1.5 },
  { id: 'vending-refuse', event: 'vending-refuse', text: '[the machine buzzes, refusing]', minSeconds: 1.5 },
  // Spec 11 H1: shown from the in phase to the end of the out phase (about 1.1 s), so the floor holds it longer.
  { id: 'screen-scare-sting', event: 'screen-scare-sting', text: '[a scream, close and sudden]', minSeconds: 1.5 },
  { id: 'screen-scare-off-zombie', event: 'screen-scare-off-zombie', text: '[a pale face lunges at you from below]', minSeconds: 3 },
  { id: 'screen-scare-off-ghost', event: 'screen-scare-off-ghost', text: '[a ghostly face drops in from above]', minSeconds: 3 },
  // Spec 11 H4: bible §14.4 asks for at least 2 s.
  { id: 'bat-chitter', event: 'bat-chitter', text: '[a bat chitters nearby]', minSeconds: 2 },
  // Spec 11 H2 (bible §14.2): each tell and each attack is captioned.
  { id: 'crawler-tell', event: 'crawler-tell', text: '[soil shivers, a wet click]', minSeconds: 2 },
  { id: 'crawler-grab', event: 'crawler-grab', text: '[a pale hand grabs]', minSeconds: 2 },
  { id: 'bride-tell', event: 'bride-tell', text: '[a cold breath, faint humming]', minSeconds: 2 },
  { id: 'bride-touch', event: 'bride-touch', text: '[a cold touch, the lantern gutters]', minSeconds: 2 },
  { id: 'hound-tell', event: 'hound-tell', text: '[a growl from the dark]', minSeconds: 2 },
  { id: 'hound-bite', event: 'hound-bite', text: '[snarling, teeth snap]', minSeconds: 2 },
]

export const CAPTION_MAP: Readonly<Record<CaptionId, CaptionDef>> = Object.fromEntries(
  CAPTIONS.map((c) => [c.id, c]),
) as Record<CaptionId, CaptionDef>
