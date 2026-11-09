// Seeded RNG (mulberry32) so loot and respawns are reproducible in tests.
// Pure TypeScript: no React, three.js or Howler imports.

/** A function returning a float in [0, 1). */
export type Rng = () => number

export function createRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Derives an independent stream seed from the run seed, so every random
 * stream replays identically on Retry Night. FNV-1a over the tag, mixed
 * with the seed and index.
 */
export function deriveSeed(seed: number, tag: string, n: number): number {
  let h = 0x811c9dc5
  for (let i = 0; i < tag.length; i++) {
    h ^= tag.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  h ^= seed >>> 0
  h = Math.imul(h, 0x01000193)
  h ^= n >>> 0
  h = Math.imul(h, 0x01000193)
  return h >>> 0
}

/** Integer in [min, max], both inclusive. */
export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}
