// Weapon pickups (design bible §4 and §7 placements). Pure data.

import type { AmmoId, FirearmId, HeavyMeleeId, RecipeId } from '../game/types'
import type { Vec3 } from './cemeteryLayout'
import {
  CHAPEL_CUPBOARD_POSITION,
  CRANE_CRYPT_STEP,
  LODGE,
  WOODPILE_POSITION,
} from './cemeteryLayout'
import type { ZoneId } from './zones'

export type WeaponPickupId = FirearmId | HeavyMeleeId

export interface WeaponPickup {
  readonly id: WeaponPickupId
  readonly zone: ZoneId
  readonly position: Vec3
  /** Satchel slots that must be free to take it (the weapon, plus its ammo stack if any). */
  readonly slotsNeeded: number
  /** Ammo granted with the weapon. */
  readonly ammo?: { readonly id: AmmoId; readonly quantity: number }
  /** Rounds loaded in the weapon when picked up. */
  readonly magazine?: number
  /** Recipe unlocked on pickup. */
  readonly recipe?: RecipeId
  /** Distance within which Interact picks it up. */
  readonly radius: number
}

export const WEAPON_PICKUPS: readonly WeaponPickup[] = [
  {
    id: 'revolver',
    zone: 'chapel',
    position: CHAPEL_CUPBOARD_POSITION,
    slotsNeeded: 2,
    ammo: { id: 'revolver-cartridge', quantity: 6 },
    magazine: 6,
    recipe: 'r-revolver-cartridge',
    radius: 1.5,
  },
  {
    id: 'shotgun',
    zone: 'mausoleum-row',
    position: LODGE.center,
    slotsNeeded: 2,
    ammo: { id: 'shotgun-shell', quantity: 4 },
    magazine: 2,
    recipe: 'r-shotgun-shell',
    radius: LODGE.pickupRadius,
  },
  {
    id: 'wood-axe',
    zone: 'grounds',
    position: WOODPILE_POSITION,
    slotsNeeded: 1,
    radius: 1.5,
  },
  {
    id: 'silver-sabre',
    zone: 'mausoleum-row',
    position: CRANE_CRYPT_STEP,
    slotsNeeded: 1,
    radius: 1.5,
  },
]
