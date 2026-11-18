// The left hand's lantern: held, hooked to the belt (shotgun) or on its strap during a throw or
// heavy swing (spec 11 H7, Req 7.4 to 7.8). Pure: the viewmodel reads the state, never sets it.
import { LANTERN_HOOK_CAPTION } from '../../data/lanternLight'
import { VIEWMODEL_TIMING } from '../../data/viewmodel'

export type LanternHandMode = 'held' | 'belt' | 'strap'

export interface LanternHandState {
  mode: LanternHandMode
  shotgunEquipped: boolean
  /** A throw or heavy swing is in progress (the lantern hangs on the strap until it ends). */
  acting: boolean
  /** Seconds since the shotgun left the hand (belt) or since the action ended (strap). */
  timerS: number
}

export const initialLanternHand = (): LanternHandState => ({
  mode: 'held',
  shotgunEquipped: false,
  acting: false,
  timerS: 0,
})

/** Equipping the shotgun hooks the lantern at once; any other weapon starts the return timer. */
export function equipWeapon(s: LanternHandState, weaponId: string): LanternHandState {
  if (weaponId === 'shotgun') {
    return { mode: 'belt', shotgunEquipped: true, acting: false, timerS: 0 }
  }
  if (!s.shotgunEquipped) return s
  return { ...s, shotgunEquipped: false, timerS: 0 }
}

/** A flask or bomb throw, or a heavy swing release, begins. The shotgun hand does neither. */
export function beginLanternAction(s: LanternHandState): LanternHandState {
  if (s.mode === 'belt') return s
  return { ...s, mode: 'strap', acting: true, timerS: 0 }
}

/** The throw or swing ends; the catch timer starts. */
export function endLanternAction(s: LanternHandState): LanternHandState {
  if (s.mode !== 'strap' || !s.acting) return s
  return { ...s, acting: false, timerS: 0 }
}

export function stepLanternHand(s: LanternHandState, dt: number): LanternHandState {
  if (!(dt > 0)) return s
  if (s.mode === 'belt' && !s.shotgunEquipped) {
    const t = s.timerS + dt
    return t >= VIEWMODEL_TIMING.beltReturnS
      ? { ...s, mode: 'held', timerS: 0 }
      : { ...s, timerS: t }
  }
  if (s.mode === 'strap' && !s.acting) {
    const t = s.timerS + dt
    return t >= VIEWMODEL_TIMING.strapCatchS
      ? { ...s, mode: 'held', timerS: 0 }
      : { ...s, timerS: t }
  }
  return s
}

/** The light follows the glass, or the belt hook while hooked. */
export function lanternAnchor(mode: LanternHandMode): 'glass' | 'belt' {
  return mode === 'belt' ? 'belt' : 'glass'
}

/** The light never goes out because of the hand: it stays on in every mode (Req 7.8). */
export function lanternLitByHand(mode: LanternHandMode): boolean {
  void mode
  return true
}

export interface HookCaptionResult {
  /** Caption text to show now, or null. */
  text: string | null
  /** The saved flag after this transition. */
  shown: boolean
}

/** Asks for the hook caption on the first move to the belt of a run (the flag is saved with it). */
export function hookCaption(
  shown: boolean,
  prev: LanternHandMode,
  next: LanternHandMode,
): HookCaptionResult {
  if (shown || next !== 'belt' || prev === 'belt') return { text: null, shown }
  return { text: LANTERN_HOOK_CAPTION, shown: true }
}
