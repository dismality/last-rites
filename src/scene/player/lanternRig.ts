// Shared scene-side bits of the lantern rig (spec 11 H7). Rendering glue only: the rules are in
// systems/lanternHand.ts and systems/lanternFlicker.ts.

import { initialLanternHand } from '../../game/systems/lanternHand'
import type { GripClass } from '../../data/viewmodel'

/**
 * Where the lantern hangs, in camera space (metres). It is in the left hand, the weapon in the
 * right, so the glass anchor sits on the left of the view and the belt hook on the left hip.
 */
export const LANTERN_ANCHORS = {
  glass: [-0.24, -0.2, -0.42],
  belt: [-0.26, -0.5, -0.12],
} as const

/** Live hand state; the viewmodel (task 6.4) writes it, the light reads it. */
export const lanternHandRuntime = { hand: initialLanternHand() }


/** Where the lantern hangs from its strap during a throw or heavy swing, in camera space (metres). */
export const LANTERN_STRAP_POSITION = [-0.2, -0.38, -0.26] as const

/**
 * What the light rig did on its last frame, for the Debug_Hook (`lanternLightState`). Written by
 * Lantern.tsx, never read by the game.
 */
export const lanternLightRuntime = {
  /** The shared flicker multiplier (the same value drove spot, fill, flame and glass). */
  signal: 1,
  /** Gutter amplitude of the current parameters (doubles under the low-oil threshold). */
  gutterAmp: 0,
  color: '#ffb46b',
  lowPass: false,
  beam: false,
  /** Seconds since oil hit 0, or null while there is oil. */
  zeroAge: null as number | null,
  spotIntensity: 0,
  fillIntensity: 0,
  emberIntensity: 0,
  flameScale: 0,
  glassEmissive: 0,
  anchor: 'glass' as 'glass' | 'belt',
  spotPosition: [0, 0, 0] as [number, number, number],
  hasCookie: false,
  castsShadow: false,
  shadowMapSize: 0,
  shadowAutoUpdate: false,
}

/** What the hands model should be doing; the viewmodel writes it, HandsRig reads it. */
export const handsRuntime = {
  grip: 'haft' as GripClass,
  /** Bumped on every throw so the Throw clip restarts. */
  throwSerial: 0,
}
