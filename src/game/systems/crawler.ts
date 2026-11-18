// Pale Crawler rules (spec 11 H2). Pure TypeScript: no React, three.js or Howler imports.
// A crawler lies hidden under a grave mound or broken coffin until the player is within 2 m,
// bursts out, warns (a soil shiver, 0.5 to 1.5 s), then grabs for 8. One grab per 1.5 s.

import { CRAWLER } from '../../data/creatures'
import { createRng, type Rng } from '../rng'
import type { AttackKind, Vec2 } from './combat'
import { tellLead } from './creatureTells'

export interface CrawlerSpot extends Vec2 {
  id: string
}

/**
 * Picks `count` (clamped to 3..6) distinct spots, or all of them when there are fewer.
 * The same seed gives the same spots, so a Retry Night finds the crawlers where they were.
 */
export function pickCrawlerSpots<T extends CrawlerSpot>(spots: readonly T[], seed: number, count: number): T[] {
  const want = Math.min(CRAWLER.spotsMax, Math.max(CRAWLER.spotsMin, Math.floor(Number.isFinite(count) ? count : 0)))
  const rng = createRng(seed)
  const pool = [...spots]
  // Partial Fisher-Yates: the first `n` slots end up as a uniform sample without repeats.
  const n = Math.min(want, pool.length)
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (pool.length - i))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, n)
}

export type CrawlerPhase = 'hidden' | 'emerged'

export interface CrawlerState {
  phase: CrawlerPhase
  x: number
  z: number
  /** Seconds until the next grab may land (cooldown after a grab). */
  grabCooldown: number
  /** Seconds left of the warning before the grab lands; null while no warning runs. */
  tellLeft: number | null
}

export interface CrawlerPlayer extends Vec2 {
  /** Facing direction on the ground plane (need not be normalised). */
  fx: number
  fz: number
}

export type CrawlerEvent =
  | { type: 'burst' }
  | { type: 'tell'; lead: number }
  | { type: 'grab'; damage: number }

export function createCrawler(spot: Vec2): CrawlerState {
  return { phase: 'hidden', x: spot.x, z: spot.z, grabCooldown: 0, tellLeft: null }
}

const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.z - b.z)

/** Advances one crawler by `dt` seconds. Never emits a grab without a warning that ran its full lead. */
export function stepCrawler(
  c: CrawlerState,
  player: Vec2,
  dt: number,
  rng: Rng,
): { crawler: CrawlerState; events: CrawlerEvent[] } {
  const step = Math.max(0, Number.isFinite(dt) ? dt : 0)
  const events: CrawlerEvent[] = []
  const d = dist(c, player)
  let next: CrawlerState = { ...c, grabCooldown: Math.max(0, c.grabCooldown - step) }

  if (c.phase === 'hidden') {
    if (d > CRAWLER.burstRangeM) return { crawler: next, events }
    const lead = tellLead(rng)
    events.push({ type: 'burst' }, { type: 'tell', lead })
    return { crawler: { ...next, phase: 'emerged', tellLeft: lead }, events }
  }

  // Emerged: drag towards the player, stopping short of standing on them.
  if (d > CRAWLER.grabReachM * 0.5) {
    const k = Math.min(CRAWLER.crawlSpeedMps * step, d - CRAWLER.grabReachM * 0.5) / d
    next = { ...next, x: c.x + (player.x - c.x) * k, z: c.z + (player.z - c.z) * k }
  }

  if (next.tellLeft === null) {
    // Warn again, but only once the last grab's cooldown is over.
    if (next.grabCooldown <= 0) {
      const lead = tellLead(rng)
      events.push({ type: 'tell', lead })
      next = { ...next, tellLeft: lead }
    }
    return { crawler: next, events }
  }

  const left = next.tellLeft - step
  if (left > 0) return { crawler: { ...next, tellLeft: left }, events }
  if (dist(next, player) <= CRAWLER.grabReachM) {
    events.push({ type: 'grab', damage: CRAWLER.grabDamage })
    next = { ...next, tellLeft: null, grabCooldown: CRAWLER.grabCooldownS }
  } else {
    // The player got away: the grab misses and the crawler warns again.
    next = { ...next, tellLeft: null }
  }
  return { crawler: next, events }
}

/** A heavy chop, or any swing made while looking down at the ground, is a downward swing. */
export function swingIsDownward(heavy: boolean, pitch: number): boolean {
  return heavy || (Number.isFinite(pitch) && pitch <= CRAWLER.downSwingPitchRad)
}

/**
 * A level swing passes over a crawler (0 damage, a miss); a downward swing, a bullet or trap fire
 * hits for the attack's normal damage.
 */
export function crawlerHit(kind: AttackKind, damage: number): { damage: number; miss: boolean } {
  const dmg = Number.isFinite(damage) ? Math.max(0, damage) : 0
  return kind === 'melee-horizontal' ? { damage: 0, miss: true } : { damage: dmg, miss: false }
}

/**
 * True when a burst this close and in front of the player should start the zombie-face scare:
 * within 1.5 m and the crawler is in the half-plane the player faces.
 */
export function faceTriggerApplies(c: Vec2, player: CrawlerPlayer): boolean {
  const dx = c.x - player.x
  const dz = c.z - player.z
  if (Math.hypot(dx, dz) > CRAWLER.faceRangeM) return false
  return dx * player.fx + dz * player.fz > 0
}
