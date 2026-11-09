// Floating damage numbers (Req 10.4 to 10.7, 10.12). Pure list transforms; the scene draws them.
import { DAMAGE_NUMBER } from '../../data/combatFeedback'

export interface DamageNumber {
  id: number
  x: number
  y: number
  z: number
  value: number
  headshot: boolean
  ageS: number
}

export interface NumberHit {
  point: readonly [number, number, number]
  damage: number
  headshot: boolean
}

/** One number per zombie hit. Off setting returns the list untouched. Oldest drop past the cap. */
export function spawnNumbers(
  list: readonly DamageNumber[],
  hits: readonly NumberHit[],
  enabled: boolean,
  nextId: number,
): { list: DamageNumber[]; nextId: number } {
  if (!enabled || hits.length === 0) return { list: [...list], nextId }
  let id = nextId
  const added: DamageNumber[] = hits.map((h) => ({
    id: id++,
    x: h.point[0],
    y: h.point[1],
    z: h.point[2],
    value: Math.round(h.damage),
    headshot: h.headshot,
    ageS: 0,
  }))
  return { list: [...list, ...added].slice(-DAMAGE_NUMBER.max), nextId: id }
}

export function tickNumbers(list: readonly DamageNumber[], dt: number): DamageNumber[] {
  const step = Math.max(0, dt)
  const out: DamageNumber[] = []
  for (const n of list) {
    const ageS = n.ageS + step
    if (ageS >= DAMAGE_NUMBER.lifeS) continue
    out.push({ ...n, ageS, y: n.y + DAMAGE_NUMBER.riseMps * step })
  }
  return out
}

/** The "!" is a text cue so headshots are not told apart by colour alone (Req 10.6). */
export const numberText = (n: DamageNumber): string => (n.headshot ? `${n.value}!` : `${n.value}`)
