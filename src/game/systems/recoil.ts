// Camera kick, aim blend and spread (design "Camera kick, aim, muzzle flash"). Pure data in, data out.
import { AIM } from '../../data/combatFeedback'

const DEG = Math.PI / 180

/** The slice of firearm stats that spread selection needs (upgrades may change either value). */
export interface SpreadStats {
  spreadHipDeg: number
  spreadAimedDeg: number
}

export interface RecoilState {
  peakRad: number
  ageS: number
  recoverS: number
}

export const INITIAL_RECOIL: RecoilState = { peakRad: 0, ageS: 0, recoverS: 0 }

/** Recoil is gameplay, so only the Camera shake setting touches it (halved when off). */
export const recoilKickDeg = (baseDeg: number, cameraShake: boolean): number =>
  cameraShake ? baseDeg : baseDeg / 2

/** Current upward offset in radians: peak × (1 − age / recover)², 0 once recovered. */
export const recoilOffsetRad = (s: RecoilState): number => {
  if (!(s.recoverS > 0) || s.ageS >= s.recoverS || s.peakRad <= 0) return 0
  const k = 1 - Math.max(0, s.ageS) / s.recoverS
  return s.peakRad * k * k
}

/** A new shot starts from where the camera currently is, so rapid fire stacks. */
export function addKick(s: RecoilState, kickDeg: number, recoverS: number): RecoilState {
  const kick = Number.isFinite(kickDeg) ? Math.max(0, kickDeg) * DEG : 0
  return { peakRad: recoilOffsetRad(s) + kick, ageS: 0, recoverS }
}

export function tickRecoil(s: RecoilState, dt: number): RecoilState {
  if (!(dt > 0) || s.peakRad === 0) return s
  const ageS = s.ageS + dt
  if (ageS >= s.recoverS) return { peakRad: 0, ageS: 0, recoverS: s.recoverS }
  return { ...s, ageS }
}

/** Moves toward 1 while aiming and toward 0 otherwise, over AIM.blendS; always in 0..1. */
export function aimBlend(prev: number, aiming: boolean, dt: number): number {
  const step = dt > 0 ? dt / AIM.blendS : 0
  const next = aiming ? prev + step : prev - step
  return Math.min(1, Math.max(0, next))
}

export const aimFovDeg = (settingFov: number, blend: number): number =>
  settingFov - AIM.fovDeg * Math.min(1, Math.max(0, blend))

export const aimMoveMult = (aiming: boolean): number => (aiming ? AIM.moveMult : 1)

export const spreadDeg = (st: SpreadStats, aiming: boolean): number =>
  aiming ? st.spreadAimedDeg : st.spreadHipDeg

/** Impact shake (thunder, hits) follows Camera shake and is off at Reduced and Off scare intensity. */
export const impactShakeAllowed = (
  cameraShake: boolean,
  scareIntensity: 'full' | 'reduced' | 'off',
): boolean => cameraShake && scareIntensity === 'full'
