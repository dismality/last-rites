// Firearm numbers mirrored from docs/game-design.md §4 "Firearms (07)".
import type { AmmoId, FirearmId } from '../game/types'

export interface FirearmDef {
  id: FirearmId
  ammo: AmmoId
  capacity: number
  reloadS: number
  fireIntervalS: number
  pellets: number
  /** Damage per ray (per pellet for the shotgun). */
  damage: number
  spreadHipDeg: number
  spreadAimedDeg: number
  headshotMult: number
  /** Revolver: hard cut-off. Shotgun: full damage up to here. */
  rangeM: number
  /** Shotgun: damage fades linearly to 0 between rangeM and here. */
  falloffEndM: number | null
  recoilUpDeg: number
  recoilRecoverS: number
  noiseRadiusM: number
  /** Rounds loaded when the weapon is picked up. */
  startMagazine: number
  /** Spare rounds granted with the pickup. */
  startAmmo: number
}

export const FIREARMS: readonly FirearmDef[] = [
  {
    id: 'revolver',
    ammo: 'revolver-cartridge',
    capacity: 6,
    reloadS: 2.4,
    fireIntervalS: 0.45,
    pellets: 1,
    damage: 34,
    spreadHipDeg: 1.5,
    spreadAimedDeg: 0.5,
    headshotMult: 2,
    rangeM: 40,
    falloffEndM: null,
    recoilUpDeg: 2.5,
    recoilRecoverS: 0.3,
    noiseRadiusM: 30,
    startMagazine: 6,
    startAmmo: 6,
  },
  {
    id: 'shotgun',
    ammo: 'shotgun-shell',
    capacity: 2,
    reloadS: 2.0,
    fireIntervalS: 0.3,
    pellets: 8,
    damage: 9,
    spreadHipDeg: 6,
    spreadAimedDeg: 5,
    headshotMult: 1.5,
    rangeM: 15,
    falloffEndM: 20,
    recoilUpDeg: 6,
    recoilRecoverS: 0.4,
    noiseRadiusM: 40,
    startMagazine: 2,
    startAmmo: 4,
  },
]

export const FIREARM_MAP: Readonly<Record<FirearmId, FirearmDef>> = {
  revolver: FIREARMS[0],
  shotgun: FIREARMS[1],
}

/** Top slice of a zombie capsule that counts as the head (m). */
export const HEAD_ZONE_M = 0.3

/** A shotgun blast from this close knocks a Brute down (duration chosen here; the bible gives 3 m). */
export const SHOTGUN_BRUTE_KNOCKDOWN = { withinM: 3, durationS: 1.5 } as const

/** Gunfire wakes dormant Lurkers this close to the shot (docs/game-design.md §4, Noise). */
export const NOISE = { lurkerWakeM: 15 } as const
