// The interaction audit as data: every thing the player can press Interact on, and which cue
// rule it follows. The cue code (systems/interactionCue.ts) and <Interactable> read this table,
// so a new interactable cannot be added without deciding what happens when it is used up,
// blocked or repeated. interactables.test.ts checks every `<Interactable kind=...>` in
// src/scene is listed here.
//
// Rule: show a cue (prompt text, hover outline, rune, pulse, hand crosshair) only when pressing
// Interact right now would do something.
//   used-up     once used, every cue fades out and the object stops being targeted.
//   needs       blocked but fixable: the prompt says what is needed, never "Hold E".
//   repeatable  stays usable; the prompt stays, the rune stops pulsing when there is nothing new.

import type { InteractAction } from '../game/systems/interaction'

export type CueCategory = 'used-up' | 'needs' | 'repeatable'

export type InteractableKind =
  | 'material-pickup'
  | 'dropped-stack'
  | 'fixed-spawn'
  | 'clue-spot'
  | 'tombstone'
  | 'gate'
  | 'altar-whistle'
  | 'case-altar'
  | 'grave-mound'
  | 'weapon-pickup'
  | 'merchant'
  | 'barricade-door'
  | 'workbench'
  | 'ledger-shelf'
  | 'bell-post'
  | 'hymn-board'
  | 'psalter'
  | 'evidence-card'
  | 'timeline-slate'
  | 'case-clue'
  | 'watch-logbook'
  | 'crest-lock'
  | 'crest-tablet'
  | 'boot-cast'

/** Things that react to Interact by proximity and draw no prompt, rune or outline of their own. */
export type ProximityKind = 'chapel-repair-point' | 'chapel-altar-heal'

export interface NeedDef {
  /** What the player lacks, in words. */
  readonly what: string
  /** Prompt template; `{need}` is replaced with the live need text (it may name the exact item). */
  readonly prompt: string
}

export interface InteractableDef {
  readonly kind: InteractableKind
  readonly action: InteractAction
  /** Main category. A used-up kind may also have a `needs` block; a repeatable one may go idle. */
  readonly category: CueCategory
  /** Hold-to-act (dig): the prompt reads "Hold E: Dig" when actionable. */
  readonly hold: boolean
  /** The object's own meshes fade away with its cues (items you take), instead of staying put. */
  readonly fadesBody: boolean
  /** Scene file that mounts it, relative to src/scene/world. Checked by the structure test. */
  readonly file: string
  /** When it counts as used up (used-up kinds) or idle (repeatable kinds). */
  readonly endsWhen: string
  /** When the used-up / idle state is undone. */
  readonly resetsOn: string
  readonly needs?: NeedDef
  /** Prompt shown instead of the action prompt when a repeatable kind has nothing new to do. */
  readonly idlePrompt?: string
}

const SATCHEL: NeedDef = { what: 'satchel space', prompt: 'Satchel full' }

export const INTERACTABLES: Readonly<Record<InteractableKind, InteractableDef>> = {
  'material-pickup': {
    kind: 'material-pickup',
    action: 'pickup',
    category: 'used-up',
    hold: false,
    fadesBody: true,
    file: 'MaterialPickups.tsx',
    endsWhen: 'the stack is taken (including loot on a dug grave)',
    resetsOn: 'respawned loot (new day), Retry Night, Continue, New Game',
    needs: SATCHEL,
  },
  'dropped-stack': {
    kind: 'dropped-stack',
    action: 'pickup',
    category: 'used-up',
    hold: false,
    fadesBody: true,
    file: 'MaterialPickups.tsx',
    endsWhen: 'the dropped stack is picked up again',
    resetsOn: 'New Game (drops are cleared)',
    needs: SATCHEL,
  },
  'fixed-spawn': {
    kind: 'fixed-spawn',
    action: 'examine',
    category: 'used-up',
    hold: false,
    fadesBody: true,
    file: 'FixedSpawns.tsx',
    endsWhen: 'the key, relic, page or ledger is taken',
    resetsOn: 'New Game; night-only relics return the next night',
  },
  'clue-spot': {
    kind: 'clue-spot',
    action: 'examine',
    category: 'used-up',
    hold: false,
    fadesBody: true,
    file: 'ClueSpots.tsx',
    endsWhen: 'the clue is recorded in the journal',
    resetsOn: 'New Game',
    needs: { what: 'the parish ledger', prompt: 'Needs {need} to make sense of this' },
  },
  tombstone: {
    kind: 'tombstone',
    action: 'read',
    category: 'repeatable',
    hold: false,
    fadesBody: false,
    file: 'Tombstones.tsx',
    endsWhen: 'the stone was read and everything it records is already in the journal',
    resetsOn: 'New Game; a stone with a new clue (ledger now held) pulses again',
  },
  gate: {
    kind: 'gate',
    action: 'open',
    category: 'used-up',
    hold: false,
    fadesBody: false,
    file: 'Gates.tsx',
    endsWhen: 'the gate or door is open',
    resetsOn: 'New Game (gates close again)',
    needs: { what: 'the matching key', prompt: 'Locked: needs {need}' },
  },
  'altar-whistle': {
    kind: 'altar-whistle',
    action: 'open',
    category: 'used-up',
    hold: false,
    fadesBody: false,
    file: 'ChapelBuilding.tsx',
    endsWhen: 'the catacomb stair is revealed',
    resetsOn: 'New Game; only exists while the Bone Whistle is held',
  },
  // Spec 10 Req 3: the altar takes the case's answer, at night only. By day it stays targetable
  // so the player can read why it is silent, but it does not call for attention.
  'case-altar': {
    kind: 'case-altar',
    action: 'open',
    category: 'repeatable',
    hold: false,
    fadesBody: false,
    file: 'ChapelBuilding.tsx',
    endsWhen: 'it is not night (the curse does not stir by day)',
    resetsOn: 'dusk, when the night begins',
    idlePrompt: 'The curse does not stir by day',
  },
  'grave-mound': {
    kind: 'grave-mound',
    action: 'dig',
    category: 'used-up',
    hold: true,
    fadesBody: false,
    file: 'GraveMounds.tsx',
    endsWhen: 'the grave is dug today (only the open pit remains)',
    resetsOn: 'the next day refills it; Retry Night keeps the day; Continue and New Game refill',
    needs: { what: 'a shovel in hand', prompt: 'Needs {need}' },
  },
  'weapon-pickup': {
    kind: 'weapon-pickup',
    action: 'pickup',
    category: 'used-up',
    hold: false,
    fadesBody: true,
    file: 'WeaponPickups.tsx',
    endsWhen: 'the weapon is taken (the woodpile stays as scenery)',
    resetsOn: 'New Game',
    needs: SATCHEL,
  },
  merchant: {
    kind: 'merchant',
    action: 'trade',
    category: 'repeatable',
    hold: false,
    fadesBody: false,
    file: 'Merchant.tsx',
    endsWhen: 'every row is sold out (used up for today)',
    resetsOn: 'the next dawn deals new stock',
  },
  'barricade-door': {
    kind: 'barricade-door',
    action: 'nail',
    category: 'repeatable',
    hold: false,
    fadesBody: false,
    file: 'ChapelDoors.tsx',
    endsWhen: 'the door holds all its boards',
    resetsOn: 'a board breaks',
    needs: { what: 'nails or planks', prompt: '{need}' },
    idlePrompt: 'Door is full',
  },
  // Spec 10 task 3.4: the parish register page on the hut shelf starts minigame 1a.
  'ledger-shelf': {
    kind: 'ledger-shelf',
    action: 'read',
    category: 'repeatable',
    hold: false,
    fadesBody: false,
    file: 'Hut.tsx',
    endsWhen: 'the ledger is cross-checked (minigame 1a solved), or the story is past stage 1',
    resetsOn: 'New Game',
    idlePrompt: 'The ledger is cross-checked',
  },
  // Spec 10 task 3.5: a safety-bell post at a candidate grave opens minigame 1b.
  'bell-post': {
    kind: 'bell-post',
    action: 'examine',
    category: 'repeatable',
    hold: false,
    fadesBody: false,
    file: 'CaseProps.tsx',
    endsWhen: 'the bells are solved (minigame 1b solved), or the story is past stage 1',
    resetsOn: 'New Game',
    idlePrompt: 'The bells are examined',
  },
  // Spec 10 task 4.3: the chapel hymn board and the vestry psalter both open minigame 3a, by day in stage 3.
  'hymn-board': {
    kind: 'hymn-board',
    action: 'read',
    category: 'repeatable',
    hold: false,
    fadesBody: false,
    file: 'CaseProps.tsx',
    endsWhen: 'the hymn tiles are solved (minigame 3a solved), or the story is not in stage 3',
    resetsOn: 'New Game',
    idlePrompt: 'The hymn board is read',
  },
  psalter: {
    kind: 'psalter',
    action: 'read',
    category: 'repeatable',
    hold: false,
    fadesBody: false,
    file: 'CaseProps.tsx',
    endsWhen: 'the hymn tiles are solved (minigame 3a solved), or the story is not in stage 3',
    resetsOn: 'New Game',
    idlePrompt: 'The psalter is read',
  },
  // Spec 10 task 4.4: a piece of Elias's last night. Examining it takes the card; it is used up once held.
  'evidence-card': {
    kind: 'evidence-card',
    action: 'examine',
    category: 'used-up',
    hold: false,
    fadesBody: true,
    file: 'CaseProps.tsx',
    endsWhen: 'the evidence card is in hand',
    resetsOn: 'New Game',
  },
  // Spec 10 task 4.4: the slate at the Crane crypt opens minigame 3b, the timeline of Elias's last night.
  'timeline-slate': {
    kind: 'timeline-slate',
    action: 'read',
    category: 'repeatable',
    hold: false,
    fadesBody: false,
    file: 'CaseProps.tsx',
    endsWhen: "Elias's night is in order (minigame 3b solved), or the story is not in stage 3",
    resetsOn: 'New Game',
    idlePrompt: "Elias's night is in order",
  },
  // Spec 10 task 5: a case clue found by walking to it (the cases' `found: { kind: 'walk' }`).
  'case-clue': {
    kind: 'case-clue',
    action: 'examine',
    category: 'used-up',
    hold: false,
    fadesBody: true,
    file: 'CaseProps.tsx',
    endsWhen: 'the clue is on the case board',
    resetsOn: 'New Game',
  },
  // Spec 10 task 5.3: the watch-house logbook on the lodge table opens minigame 2b.
  'watch-logbook': {
    kind: 'watch-logbook',
    action: 'read',
    category: 'repeatable',
    hold: false,
    fadesBody: false,
    file: 'CaseProps.tsx',
    endsWhen: 'the watch log is in order (minigame 2b solved), or the story is not in stage 2',
    resetsOn: 'New Game',
    idlePrompt: 'The watch log is in order',
  },
  // Spec 10 task 5.4: the crest dials in the sexton's niche open minigame 2a.
  'crest-lock': {
    kind: 'crest-lock',
    action: 'examine',
    category: 'repeatable',
    hold: false,
    fadesBody: false,
    file: 'CaseProps.tsx',
    endsWhen: "the niche is open (minigame 2a solved), or the story is not in stage 2",
    resetsOn: 'New Game',
    idlePrompt: 'The niche is open',
  },
  // Spec 10 task 5.4: a crypt name tablet on Mausoleum Row; reading it says the family, crest and year.
  'crest-tablet': {
    kind: 'crest-tablet',
    action: 'read',
    category: 'repeatable',
    hold: false,
    fadesBody: false,
    file: 'CaseProps.tsx',
    endsWhen: "the niche is open (minigame 2a solved), or the story is not in stage 2",
    resetsOn: 'New Game',
    idlePrompt: 'A crypt name tablet',
  },
  // Spec 10 task 5.5: a plaster cast at the Ames grave opens minigame 2c.
  'boot-cast': {
    kind: 'boot-cast',
    action: 'examine',
    category: 'repeatable',
    hold: false,
    fadesBody: false,
    file: 'CaseProps.tsx',
    endsWhen: 'the boots are matched (minigame 2c solved), or the story is not in stage 2',
    resetsOn: 'New Game',
    idlePrompt: 'The boots are matched',
  },
  workbench: {
    kind: 'workbench',
    action: 'open',
    category: 'repeatable',
    hold: false,
    fadesBody: false,
    file: 'Workbench.tsx',
    endsWhen: 'never: crafting is always available',
    resetsOn: 'not applicable',
  },
}

export interface ProximityDef {
  readonly kind: ProximityKind
  readonly category: CueCategory
  readonly file: string
  readonly note: string
}

/** Proximity triggers draw no cue at all, so there is nothing that can mislead. */
export const PROXIMITY_TRIGGERS: Readonly<Record<ProximityKind, ProximityDef>> = {
  'chapel-repair-point': {
    kind: 'chapel-repair-point',
    category: 'repeatable',
    file: 'Chapel.tsx',
    note: 'E near the door opens the repair menu; no prompt, rune or outline',
  },
  'chapel-altar-heal': {
    kind: 'chapel-altar-heal',
    category: 'used-up',
    file: 'Chapel.tsx',
    note: 'E at the lit altar heals once a day; no prompt, rune or outline',
  },

}

export const INTERACTABLE_KINDS = Object.keys(INTERACTABLES) as InteractableKind[]

/** Seconds every cue takes to fade once an object is used up. */
export const CUE_FADE_S = 0.5

/** Guttering ripple on a fade when Flashing lights is on: strength = floor + depth * sin(rate * t). */
export const CUE_FLICKER = { floor: 0.88, depth: 0.12, rateRadPerS: 38 } as const
