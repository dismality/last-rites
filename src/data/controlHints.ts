// Controls hint panel (design bible §11). Pure data: what each line says, when it applies and
// how it is cleared. The show and clear rules live in systems/controlHints.ts.

export type ControlHintId = 'move' | 'sprint' | 'charge'

export type ControlHintClear =
  | { kind: 'distance'; metres: number }
  | { kind: 'sprint'; seconds: number }
  | { kind: 'heavy-swing' }

export interface ControlHintDef {
  id: ControlHintId
  /** Binding actions whose keys are drawn as key caps, in order. */
  actions: readonly string[]
  /** Plain text before the key caps (for example "Hold"). */
  prefix?: string
  word: string
  /** Shown only while a heavy-charge weapon (axe, sabre) is in hand. */
  needsHeavyWeapon: boolean
  clear: ControlHintClear
}

export const CONTROL_HINTS: readonly ControlHintDef[] = [
  {
    id: 'move',
    actions: ['MoveForward', 'MoveLeft', 'MoveBackward', 'MoveRight'],
    word: 'Move',
    needsHeavyWeapon: false,
    clear: { kind: 'distance', metres: 10 },
  },
  {
    id: 'sprint',
    actions: ['Sprint'],
    word: 'Sprint',
    needsHeavyWeapon: false,
    clear: { kind: 'sprint', seconds: 2 },
  },
  {
    id: 'charge',
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
}

export const STAMINA_CAPTION = 'Stamina'
