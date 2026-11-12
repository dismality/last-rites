// Registry of live interactables so the raycast can target them and fire their handler.
// Module-level (not React state) because it is read every frame.

import type { Object3D } from 'three'
import type { InteractionCue } from '../../game/systems/interactionCue'
import type { InteractAction } from '../../game/systems/interaction'

export interface InteractableEntry {
  id: string
  action: InteractAction
  object: Object3D
  onInteract: () => void
  /** Live cue from the shared rule; the raycast only selects entries whose cue is targetable. */
  cue: () => InteractionCue
}

export const interactableRegistry = new Map<string, InteractableEntry>()
