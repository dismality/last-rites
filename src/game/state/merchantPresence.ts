// Silas at the gate: who is present, opening the trade menu, and the arrival / leaving cues.
// Pure zustand glue, no React / three.js imports.
import { majorScareActive } from '../systems/scareSilence'
import { canOpenMerchant, merchantPresent, withinTradeRange } from '../systems/merchant'
import { emitCombatSound } from './combatSounds'
import { musicRuntime } from './musicRuntime'
import { useOverlayStore } from './overlayStore'
import { usePlayerStore } from './playerStore'
import { closeMerchant, openMerchant } from './progressionActions'
import { useProgressionStore } from './progressionStore'
import { simClock } from './simClock'
import { useWorldStore } from './worldStore'

export function isMerchantPresent(): boolean {
  return merchantPresent(useWorldStore.getState(), useProgressionStore.getState().stock)
}

/** "E: Trade" handler. Returns whether the menu opened. */
export function tryTrade(): boolean {
  const [x, , z] = usePlayerStore.getState().position
  const ok = canOpenMerchant({
    phase: useWorldStore.getState().phase,
    present: isMerchantPresent(),
    majorActive: majorScareActive(musicRuntime.silence, simClock.now),
    inRange: withinTradeRange({ x, z }),
  })
  if (ok) openMerchant()
  return ok
}

/**
 * Call whenever presence may have changed. Announces arrival and leaving once per change and
 * closes an open menu the moment he goes. Returns the new presence for the caller to remember.
 */
export function syncMerchantPresence(was: boolean): boolean {
  const now = isMerchantPresent()
  if (now && !was) emitCombatSound('merchant-arrive')
  if (!now && was) {
    emitCombatSound('merchant-leave')
    if (useOverlayStore.getState().merchantOpen) closeMerchant()
  }
  return now
}
