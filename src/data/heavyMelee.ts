// Heavy melee numbers mirrored from docs/game-design.md §4. Light damage, speed and
// durability live in weapons.ts.
import type { HeavyMeleeId } from '../game/types'

export interface HeavyDef {
  id: HeavyMeleeId
  chargeS: number
  heavyDamage: number
  staminaCost: number
  /** How long a heavy hit keeps a zombie on the ground. */
  knockdownS: number
  /** Extra damage fraction against Wailers (0.5 = +50%). */
  wailerBonus: number
}

export const HEAVY_MELEE: readonly HeavyDef[] = [
  { id: 'wood-axe', chargeS: 0.8, heavyDamage: 70, staminaCost: 25, knockdownS: 1.5, wailerBonus: 0 },
  { id: 'silver-sabre', chargeS: 0.6, heavyDamage: 60, staminaCost: 20, knockdownS: 1.2, wailerBonus: 0.5 },
]

export const HEAVY_MAP: Readonly<Record<HeavyMeleeId, HeavyDef>> = {
  'wood-axe': HEAVY_MELEE[0],
  'silver-sabre': HEAVY_MELEE[1],
}
