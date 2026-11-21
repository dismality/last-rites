// Controls hint panel (design bible §11), a short staged tutorial of every control (11s). Pure
// data: what each line says, when it applies and how it is cleared. The show and clear rules live in systems/controlHints.ts.

export type ControlHintId =
  | 'move'
  | 'look'
  | 'sprint'
  | 'lantern'
  | 'interact'
  | 'journal'
  | 'satchel'
  | 'hotbar'
  | 'map'
  | 'pause'
  | 'attack'
  | 'block'
  | 'dodge'
  | 'kick'
  | 'reload'
  | 'charge'

/**
 * When a line shows. The panel is a short staged tutorial (11s): `start` lines first; once each is
 * used, the `next` lines; at dusk and night the `night` (fighting) lines take their place; `weapon`
 * lines whenever their weapon is in hand.
 */
export type ControlHintGroup = 'start' | 'next' | 'night' | 'weapon'

export type ControlHintClear =
  | { kind: 'distance'; metres: number }
  | { kind: 'sprint'; seconds: number }
  | { kind: 'heavy-swing' }
  /** Cleared the first time any of these binding actions is pressed. */
  | { kind: 'press'; actions: readonly string[] }
  /** Cleared once the mouse has moved this many screen pixels in total. */
  | { kind: 'look'; pixels: number }

export interface ControlHintDef {
  id: ControlHintId
  group: ControlHintGroup
  /** Binding actions whose keys are drawn as key caps, in order. */
  actions: readonly string[]
  /** Key caps drawn as written, for an input with no binding (the mouse look). */
  fixedKeys?: readonly string[]
  /** Plain text before the key caps (for example "Hold"). */
  prefix?: string
  word: string
  /** Shown only while a heavy-charge weapon (axe, sabre) is in hand. */
  needsHeavyWeapon: boolean
  clear: ControlHintClear
}

const press = (...actions: string[]): ControlHintClear => ({ kind: 'press', actions })

export const CONTROL_HINTS: readonly ControlHintDef[] = [
  {
    id: 'move',
    group: 'start',
    actions: ['MoveForward', 'MoveLeft', 'MoveBackward', 'MoveRight'],
    word: 'Move',
    needsHeavyWeapon: false,
    clear: { kind: 'distance', metres: 10 },
  },
  {
    id: 'look',
    group: 'start',
    actions: [],
    fixedKeys: ['Mouse'],
    word: 'Look around',
    needsHeavyWeapon: false,
    clear: { kind: 'look', pixels: 600 },
  },
  {
    id: 'sprint',
    group: 'start',
    actions: ['Sprint'],
    prefix: 'Hold',
    word: 'Sprint (uses stamina)',
    needsHeavyWeapon: false,
    clear: { kind: 'sprint', seconds: 2 },
  },
  {
    id: 'lantern',
    group: 'start',
    actions: ['Lantern'],
    word: 'Lantern on or off (it burns oil)',
    needsHeavyWeapon: false,
    clear: press('Lantern'),
  },
  {
    id: 'interact',
    group: 'start',
    actions: ['Interact'],
    word: 'Use, pick up or read',
    needsHeavyWeapon: false,
    clear: press('Interact'),
  },
  {
    id: 'journal',
    group: 'next',
    actions: ['Journal'],
    word: 'Journal: pages, map and the case board',
    needsHeavyWeapon: false,
    clear: press('Journal'),
  },
  {
    id: 'satchel',
    group: 'next',
    actions: ['Satchel'],
    word: 'Satchel: everything you carry',
    needsHeavyWeapon: false,
    clear: press('Satchel'),
  },
  {
    id: 'hotbar',
    group: 'next',
    actions: ['Hotbar1', 'Hotbar2', 'Hotbar3', 'Hotbar4'],
    word: 'Switch the item in hand',
    needsHeavyWeapon: false,
    clear: press('Hotbar1', 'Hotbar2', 'Hotbar3', 'Hotbar4'),
  },
  {
    id: 'map',
    group: 'next',
    actions: ['Map'],
    word: 'Big map',
    needsHeavyWeapon: false,
    clear: press('Map'),
  },
  {
    id: 'pause',
    group: 'next',
    actions: ['Pause'],
    word: 'Pause, settings and controls',
    needsHeavyWeapon: false,
    clear: press('Pause'),
  },
  {
    id: 'attack',
    group: 'night',
    actions: ['Attack'],
    word: 'Attack',
    needsHeavyWeapon: false,
    clear: press('Attack'),
  },
  {
    id: 'block',
    group: 'night',
    actions: ['Block'],
    prefix: 'Hold',
    word: 'Block',
    needsHeavyWeapon: false,
    clear: press('Block'),
  },
  {
    id: 'dodge',
    group: 'night',
    actions: ['Dodge'],
    word: 'Dodge',
    needsHeavyWeapon: false,
    clear: press('Dodge'),
  },
  {
    id: 'kick',
    group: 'night',
    actions: ['Kick'],
    word: 'Kick them back',
    needsHeavyWeapon: false,
    clear: press('Kick'),
  },
  {
    id: 'reload',
    group: 'night',
    actions: ['Reload'],
    word: 'Reload a gun',
    needsHeavyWeapon: false,
    clear: press('Reload'),
  },
  {
    id: 'charge',
    group: 'weapon',
    actions: ['HeavyAttack'],
    prefix: 'Hold',
    word: 'Charge a heavy swing',
    needsHeavyWeapon: true,
    clear: { kind: 'heavy-swing' },
  },
]

export const CONTROL_HINT_IDS: readonly ControlHintId[] = CONTROL_HINTS.map((h) => h.id)

/** Weapons whose heavy swing charges (mirrors HeavyMeleeId; kept here so data stays import-free). */
export const CHARGE_WEAPONS: readonly string[] = ['wood-axe', 'silver-sabre']

/** Seconds a cleared line takes to fade out (a steady fade, never a flicker). */
export const CONTROL_HINT_FADE_S = 0.6

/** Readable names for key codes the shared keyLabel leaves raw. */
export const KEY_NAMES: Readonly<Record<string, string>> = {
  Space: 'Space',
  Escape: 'Esc',
  ControlLeft: 'Ctrl',
  ControlRight: 'Ctrl',
  AltLeft: 'Alt',
  AltRight: 'Alt',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  MouseLeft: 'Mouse 1',
  MouseMiddle: 'Mouse 3',
  MouseRight: 'Mouse 2',
  Tab: 'Tab',
}

export const STAMINA_CAPTION = 'Stamina'
