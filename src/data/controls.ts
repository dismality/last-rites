/** Rebindable actions in the order the Controls panel lists them (Req 21.7). */
export const CONTROL_ACTIONS: ReadonlyArray<{ action: string; label: string }> = [
  { action: 'MoveForward', label: 'Move forward' },
  { action: 'MoveBackward', label: 'Move backward' },
  { action: 'MoveLeft', label: 'Move left' },
  { action: 'MoveRight', label: 'Move right' },
  { action: 'Sprint', label: 'Sprint' },
  { action: 'Interact', label: 'Interact' },
  { action: 'Attack', label: 'Attack / fire' },
  { action: 'Block', label: 'Block / Aim' },
  { action: 'HeavyAttack', label: 'Heavy attack' },
  { action: 'Reload', label: 'Reload' },
  { action: 'Kick', label: 'Kick' },
  { action: 'Dodge', label: 'Dodge' },
  { action: 'Hotbar1', label: 'Hotbar 1' },
  { action: 'Hotbar2', label: 'Hotbar 2' },
  { action: 'Hotbar3', label: 'Hotbar 3' },
  { action: 'Hotbar4', label: 'Hotbar 4' },
  { action: 'Satchel', label: 'Satchel' },
  { action: 'Journal', label: 'Journal / map' },
  { action: 'Lantern', label: 'Lantern on/off' },
  { action: 'Map', label: 'Big map' },
  { action: 'Minimap', label: 'Minimap on/off' },
  { action: 'Skip', label: 'Skip cutscene' },
]

/** Shown for Pause, which can never be rebound so the player can always pause. */
export const FIXED_CONTROL_LABEL = 'Pause'

/** Mouse button index (MouseEvent.button) to binding code. */
export const MOUSE_BUTTON_CODES: readonly string[] = ['MouseLeft', 'MouseMiddle', 'MouseRight']
