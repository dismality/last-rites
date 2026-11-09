// Grave Coin drops and ground piles. Pure rules: no React, three.js or Howler.

import { COIN_DROPS, COIN_PILE, ELITE_COIN_BONUS } from '../../data/graveCoins'
import { UPGRADE_PER_RANK } from '../../data/dawnUpgrades'
import type { WaveEnemyId } from '../../data/enemies'
import type { Rng } from '../rng'
import type { Vec2 } from './combat'

export interface CoinPile {
  id: number
  x: number
  z: number
  amount: number
  /** Seconds since the pile appeared. */
  age: number
}

/**
 * Coins for one kill. The rng is drawn only when the type's chance is below 1,
 * so a fixed-drop enemy never advances the stream. The elite bonus is paid even
 * when a Shambler's roll fails; Grim Harvest scales the total and rounds down.
 */
export function coinDrop(rng: Rng, enemy: WaveEnemyId, elite: boolean, grimRank: number): number {
  const row = COIN_DROPS[enemy]
  const hit = row.chance >= 1 || rng() < row.chance
  const base = (hit ? row.amount : 0) + (elite ? ELITE_COIN_BONUS : 0)
  return Math.floor(base * (1 + UPGRADE_PER_RANK.coinDrop * Math.max(0, grimRank)))
}

/**
 * Adds a pile, merging into the nearest pile within the merge radius. At the cap
 * the oldest pile is removed and its amount returned as overflow, so the caller
 * can bank it: the cap never costs the player coins.
 */
export function addPile(
  piles: readonly CoinPile[],
  x: number,
  z: number,
  amount: number,
  id: number,
): { piles: CoinPile[]; overflow: number } {
  if (amount <= 0) return { piles: [...piles], overflow: 0 }
  let nearest = -1
  let best: number = COIN_PILE.mergeRadiusM
  piles.forEach((p, i) => {
    const d = Math.hypot(p.x - x, p.z - z)
    if (d <= best) {
      best = d
      nearest = i
    }
  })
  if (nearest >= 0) {
    return {
      piles: piles.map((p, i) => (i === nearest ? { ...p, amount: p.amount + amount } : p)),
      overflow: 0,
    }
  }
  const next = [...piles]
  let overflow = 0
  if (next.length >= COIN_PILE.maxPiles) {
    let oldest = 0
    next.forEach((p, i) => {
      const o = next[oldest]
      if (p.age > o.age || (p.age === o.age && p.id < o.id)) oldest = i
    })
    overflow = next[oldest].amount
    next.splice(oldest, 1)
  }
  next.push({ id, x, z, amount, age: 0 })
  return { piles: next, overflow }
}

/**
 * Ages piles. A pile within the collect radius is taken once (its id is listed in
 * `collected`); a pile that reaches the fade age is dropped and its coins are lost.
 */
export function stepPiles(
  piles: readonly CoinPile[],
  dt: number,
  player: Vec2,
): { piles: CoinPile[]; collected: number[] } {
  const kept: CoinPile[] = []
  const collected: number[] = []
  for (const p of piles) {
    if (Math.hypot(p.x - player.x, p.z - player.z) <= COIN_PILE.collectRadiusM) {
      collected.push(p.id)
      continue
    }
    const age = p.age + dt
    if (age >= COIN_PILE.fadeAfterS) continue
    kept.push({ ...p, age })
  }
  return { piles: kept, collected }
}

/** 1 until the last shrink window, then eases linearly to 0 at the fade age. */
export function pileScale(age: number): number {
  const left = COIN_PILE.fadeAfterS - age
  if (left >= COIN_PILE.shrinkLastS) return 1
  return Math.max(0, left / COIN_PILE.shrinkLastS)
}
