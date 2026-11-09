// Per-frame firearm values shared between the weapon controller, camera and viewmodel.
// Mutable refs rather than store state: they change every frame and only the scene reads them.
import { INITIAL_RECOIL, type RecoilState } from '../../game/systems/recoil'

export interface CameraSnapshot {
  position: [number, number, number]
  /** Unit forward vector of the camera, before the recoil offset. */
  direction: [number, number, number]
}

export interface MuzzleEvent {
  /** Seconds since the shot. */
  ageS: number
  kind: 'revolver' | 'shotgun'
}

export const weaponRuntime = {
  /** Aim button held with a firearm in hand. */
  aiming: false,
  /** Smoothed 0..1 aim blend. */
  aimBlend: 0,
  recoil: INITIAL_RECOIL as RecoilState,
  camera: { position: [0, 0, 0], direction: [0, 0, -1] } as CameraSnapshot,
  /** Muzzle flashes waiting for the viewmodel to pick them up. */
  muzzleEvents: [] as MuzzleEvent[],
}

export function resetWeaponRuntime(): void {
  weaponRuntime.aiming = false
  weaponRuntime.aimBlend = 0
  weaponRuntime.recoil = INITIAL_RECOIL
  weaponRuntime.camera = { position: [0, 0, 0], direction: [0, 0, -1] }
  weaponRuntime.muzzleEvents = []
}
