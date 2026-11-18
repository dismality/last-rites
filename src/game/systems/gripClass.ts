// Which hand pose a held weapon uses (spec 11 H7, Req 7.2). Pure and total over the weapon ids.
import { GRIP_TABLE, type GripClass, type GripWeaponId } from '../../data/viewmodel'

export const GRIP_WEAPON_IDS = Object.keys(GRIP_TABLE) as readonly GripWeaponId[]

/** Revolver is a pistol grip, shotgun a long grip, every melee weapon a haft grip. */
export function gripFor(weaponId: GripWeaponId): GripClass {
  switch (weaponId) {
    case 'revolver':
      return 'pistol'
    case 'shotgun':
      return 'long'
    case 'rusty-shovel':
    case 'sharpened-shovel':
    case 'wood-axe':
    case 'bone-club':
    case 'silver-sabre':
      return 'haft'
    default: {
      // A new weapon id that is missing above stops compiling here.
      const unreachable: never = weaponId
      return unreachable
    }
  }
}
