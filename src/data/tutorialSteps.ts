// First-day tutorial (design bible §11). Templates carry `{Action}` tokens that are
// replaced with the player's current key bindings, so rebinding changes the prompt.

export type TutorialStepId = 1 | 2 | 3 | 4 | 5 | 6 | 7

export type TutorialAction =
  | 'walk'
  | 'pickup'
  | 'readPage'
  | 'dig'
  | 'craft'
  | 'bindHotbar'
  | 'openJournal'

export interface TutorialStepDef {
  readonly id: TutorialStepId
  readonly action: TutorialAction
  readonly template: string
}

export const TUTORIAL_STEPS: readonly TutorialStepDef[] = [
  {
    id: 1,
    action: 'walk',
    template: '{MoveForward} {MoveLeft} {MoveBackward} {MoveRight} to move, mouse to look',
  },
  { id: 2, action: 'pickup', template: '{Interact} to pick up the oil on the shelf' },
  { id: 3, action: 'readPage', template: '{Interact} to read the page Elias left' },
  { id: 4, action: 'dig', template: 'Hold {Interact} on a grave mound to dig (shovel in hand)' },
  { id: 5, action: 'craft', template: '{Interact} at the workbench to craft' },
  {
    id: 6,
    action: 'bindHotbar',
    template: '{Satchel} opens the satchel; press {Hotbar1}–{Hotbar4} on an item to bind it',
  },
  { id: 7, action: 'openJournal', template: '{Journal} opens the journal and map' },
]

/** Distance in metres the player must walk to finish step 1. */
export const TUTORIAL_WALK_TARGET_M = 3

/** Prefix on every prompt so it is never told apart by colour alone. */
export const TUTORIAL_GLYPH = '✎'
