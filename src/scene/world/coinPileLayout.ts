// Pure placement maths for the Grave Coin heaps, kept apart from three.js so it tests in Node.
import { COIN_PILE } from '../../data/graveCoins'
import { pileScale, type CoinPile } from '../../game/systems/coins'

/** Heap size grows with the amount, but stops growing so a big merge stays readable. */
const BASE_SCALE = 0.8
const PER_COIN_SCALE = 0.04
const AMOUNT_CAP = 10
/** Below this a shrinking pile is skipped rather than drawn as a speck. */
const MIN_VISIBLE_SCALE = 0.01

export interface PileInstance {
  x: number
  z: number
  /** Uniform scale including the last-2-seconds shrink. */
  scale: number
  /** Stable per-pile spin so heaps do not all face the same way. */
  yaw: number
}

/** Instances for the visible piles, capped at the pool size. */
export function pileInstances(piles: readonly CoinPile[]): PileInstance[] {
  const out: PileInstance[] = []
  for (const p of piles) {
    if (out.length >= COIN_PILE.maxPiles) break
    const fade = pileScale(p.age)
    if (fade < MIN_VISIBLE_SCALE) continue
    const size = BASE_SCALE + Math.min(Math.max(p.amount, 0), AMOUNT_CAP) * PER_COIN_SCALE
    out.push({ x: p.x, z: p.z, scale: size * fade, yaw: p.id * 2.399 })
  }
  return out
}
