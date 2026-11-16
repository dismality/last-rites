// While a menu or a scripted camera owns the view, the player's mouse travel must not pile up
// and release as one big turn when control returns.

import { endingCameraRuntime } from '../effects/endingCameraRuntime'
import { introCameraRuntime } from '../effects/introCameraRuntime'
import { workbenchCameraRuntime } from '../world/workbenchCameraRuntime'
import { isMenuOpen } from '../../game/state/menuState'
import { useDescentStore } from '../../game/state/descentStore'

/** True when the first-person controller must not read look input this frame. */
export function isViewOwned(): boolean {
  return (
    isMenuOpen() ||
    workbenchCameraRuntime.active ||
    endingCameraRuntime.active ||
    introCameraRuntime.active ||
    // The stair descent holds input only while the screen is black (spec 09 task 11n-f).
    useDescentStore.getState().locked
  )
}

/** Drops collected look movement while the view is owned. Returns whether it discarded. */
export function discardLookWhileOwned(owned: boolean, input: { discardLook: () => void }): boolean {
  if (owned) input.discardLook()
  return owned
}
