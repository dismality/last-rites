// Scripted damage floor (spec 11 Req 2.20). Pure TypeScript.
// A creature or scripted event never takes the player below 1 HP if they were above 1 HP when it
// began. Ordinary combat is unchanged: this guard is only for the new creatures' damage.

import { SCRIPTED_HP_FLOOR } from '../../data/creatures'

const num = (n: number): number => (Number.isFinite(n) ? n : 0)

/** HP after `dmg`: never under 1 when the event started above 1, otherwise the normal result (min 0). */
export function clampScriptedDamage(hp: number, hpAtEventStart: number, dmg: number): number {
  const after = num(hp) - Math.max(0, num(dmg))
  return num(hpAtEventStart) > SCRIPTED_HP_FLOOR ? Math.max(SCRIPTED_HP_FLOOR, after) : Math.max(0, after)
}

/** The damage that is actually applied through `hurtPlayer` once the floor is honoured. */
export function guardedDamage(hp: number, hpAtEventStart: number, dmg: number): number {
  return Math.max(0, num(hp) - clampScriptedDamage(hp, hpAtEventStart, dmg))
}
