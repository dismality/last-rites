// Tileable detail for the world's surfaces, built in code at load (no image files). Each surface
// kind is a height field drawn from periodic noise and a few patterns (grain, fissures, pits,
// cracks); its slopes become a normal, and the height also darkens hollows and roughens them.
// Pure data: the shader side lives in surfaceDetail.ts.

export type SurfaceKind = 'stone' | 'plaster' | 'wood' | 'slate' | 'earth' | 'bark' | 'iron' | 'ground'

export const SURFACE_KINDS: readonly SurfaceKind[] = ['stone', 'plaster', 'wood', 'slate', 'earth', 'bark', 'iron', 'ground']

/** Texture size in pixels (square, power of two, so it mipmaps and repeats). */
export const SURFACE_TEX = 256

/** How many metres one repeat of each kind covers, and how strong its bump and tint are. */
export const SURFACE_LOOK: Record<SurfaceKind, { metres: number; bump: number; tint: number; rough: number }> = {
  stone: { metres: 1.4, bump: 0.9, tint: 0.34, rough: 0.12 },
  plaster: { metres: 2.2, bump: 0.45, tint: 0.22, rough: 0.06 },
  wood: { metres: 1.2, bump: 0.7, tint: 0.36, rough: 0.1 },
  slate: { metres: 1.0, bump: 0.6, tint: 0.28, rough: 0.12 },
  earth: { metres: 1.6, bump: 0.8, tint: 0.4, rough: 0.05 },
  bark: { metres: 0.9, bump: 1.0, tint: 0.42, rough: 0.08 },
  iron: { metres: 0.5, bump: 0.5, tint: 0.3, rough: 0.2 },
  ground: { metres: 3.0, bump: 0.7, tint: 0.45, rough: 0.05 },
}

/** A small seeded random (mulberry32), so every load draws the same surfaces. */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Periodic value noise: a lattice of `cells` per side that wraps, smoothly interpolated. */
function lattice(cells: number, seed: number): (u: number, v: number) => number {
  const r = rng(seed)
  const g = new Float32Array(cells * cells)
  for (let i = 0; i < g.length; i++) g[i] = r()
  const at = (x: number, y: number) => g[(((y % cells) + cells) % cells) * cells + (((x % cells) + cells) % cells)]
  const s = (t: number) => t * t * (3 - 2 * t)
  return (u, v) => {
    const x = u * cells
    const y = v * cells
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const fx = s(x - x0)
    const fy = s(y - y0)
    const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * fx
    const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * fx
    return a + (b - a) * fy
  }
}

/** Fractal noise from octaves of periodic lattices (every octave wraps, so the sum does). */
function fbm(base: number, octaves: number, seed: number): (u: number, v: number) => number {
  const layers = Array.from({ length: octaves }, (_, i) => lattice(base << i, seed + i * 101))
  return (u, v) => {
    let sum = 0
    let amp = 0.5
    let norm = 0
    for (const l of layers) {
      sum += l(u, v) * amp
      norm += amp
      amp *= 0.5
    }
    return sum / norm
  }
}

/** Distance to the nearest of `n` wrapped points and to the second nearest (Worley cells). */
function cells(n: number, seed: number): (u: number, v: number) => [number, number] {
  const r = rng(seed)
  const pts = Array.from({ length: n }, () => [r(), r()] as const)
  return (u, v) => {
    let d1 = 9
    let d2 = 9
    for (const [px, py] of pts) {
      let dx = Math.abs(u - px)
      let dy = Math.abs(v - py)
      if (dx > 0.5) dx = 1 - dx
      if (dy > 0.5) dy = 1 - dy
      const d = Math.hypot(dx, dy)
      if (d < d1) {
        d2 = d1
        d1 = d
      } else if (d < d2) d2 = d
    }
    return [d1, d2]
  }
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

/** The height field of one surface kind, 0 (deep) to 1 (proud), `size` by `size`, wrapping. */
export function surfaceHeight(kind: SurfaceKind, size = SURFACE_TEX): Float32Array {
  const h = new Float32Array(size * size)
  const seed = SURFACE_KINDS.indexOf(kind) * 977 + 1891
  const warp = fbm(4, 3, seed + 7)
  const big = fbm(4, 5, seed + 13)
  const fine = fbm(32, 3, seed + 29)
  const cell = cells(kind === 'earth' ? 70 : 26, seed + 41)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size
      const v = y / size
      let value: number
      switch (kind) {
        case 'stone': {
          // Weathered face: broad undulation, pitting, and a few hairline cracks along cell edges.
          const [d1, d2] = cell(u, v)
          const crack = 1 - smooth(0, 0.012, d2 - d1)
          const pits = smooth(0.62, 0.78, fine(u, v))
          value = 0.55 * big(u, v) + 0.35 * fine(u, v) - 0.35 * pits - 0.45 * crack * smooth(0.35, 0.6, warp(u, v))
          break
        }
        case 'plaster': {
          value = 0.6 * big(u, v) + 0.4 * fine(u, v) - 0.2 * smooth(0.7, 0.85, fine(u * 1, v * 1))
          break
        }
        case 'wood': {
          // Grain runs along u: rings bent by noise, fine fibres, and the odd dark knot.
          // Straight grain with a gentle drift (a strong warp read as water ripples).
          const bend = (warp(u, v) - 0.5) * 0.9
          const ring = Math.sin((v * 9 + bend) * Math.PI * 2)
          // Integer frequencies only, so the texture still wraps.
          const fibre = 0.5 + 0.5 * Math.sin((v * 48 + big(u, v) * 2) * Math.PI * 2)
          const [k1] = cell(u, v)
          const knot = 1 - smooth(0, 0.035, k1)
          value = 0.5 + 0.16 * ring + 0.12 * (fibre - 0.5) + 0.22 * (big(u, v) - 0.5) - 0.6 * knot * (k1 < 0.035 && warp(v, u) > 0.55 ? 1 : 0)
          break
        }
        case 'slate': {
          // Split layers: streaks along u with chipped edges.
          const layer = Math.sin((v * 18 + big(u, v) * 2) * Math.PI * 2)
          value = 0.5 + 0.2 * layer + 0.3 * (fine(u, v) - 0.5) - 0.3 * smooth(0.7, 0.82, warp(u, v))
          break
        }
        case 'earth': {
          // Clods and small stones: Worley bumps on fractal soil.
          const [d1] = cell(u, v)
          const pebble = 1 - smooth(0.0, 0.05, d1)
          value = 0.45 * big(u, v) + 0.3 * fine(u, v) + 0.35 * pebble
          break
        }
        case 'bark': {
          // Deep vertical fissures (along v) between ridged plates.
          const f = Math.abs(Math.sin((u * 9 + warp(u, v) * 1.6) * Math.PI))
          const plates = smooth(0.08, 0.5, f)
          value = 0.25 + 0.55 * plates + 0.2 * (fine(u, v) - 0.5) + 0.15 * (big(u, v) - 0.5)
          break
        }
        case 'ground': {
          // Turf: matted clumps, bare soil between, and leaf-litter flecks.
          const [d1, d2] = cell(u, v)
          const clump = smooth(0.0, 0.06, d2 - d1)
          value = 0.35 + 0.3 * clump + 0.25 * (big(u, v) - 0.5) + 0.25 * (fine(u, v) - 0.5)
          break
        }
        case 'iron': {
          // Rust blisters and pits.
          const blister = smooth(0.55, 0.75, big(u, v))
          value = 0.5 + 0.3 * blister + 0.25 * (fine(u, v) - 0.5) - 0.3 * smooth(0.72, 0.8, fine(v, u))
          break
        }
      }
      h[y * size + x] = clamp01(value)
    }
  }
  return h
}

/**
 * Packs a height field into RGBA bytes: R and G the normal's x and y slopes (0.5 is flat),
 * B the tint (0.5 is no change; hollows darker), A the height itself (roughness in hollows).
 */
export function packSurface(h: Float32Array, size = SURFACE_TEX, strength = 1): Uint8Array {
  const out = new Uint8Array(size * size * 4)
  const at = (x: number, y: number) => h[(((y % size) + size) % size) * size + (((x % size) + size) % size)]
  const k = strength * size * 0.05
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * k
      const dy = (at(x, y + 1) - at(x, y - 1)) * k
      const len = Math.hypot(dx, dy, 1)
      const i = (y * size + x) * 4
      out[i] = Math.round((0.5 - (dx / len) * 0.5) * 255)
      out[i + 1] = Math.round((0.5 - (dy / len) * 0.5) * 255)
      // Mid-heights keep their colour; hollows darken more than ridges lighten.
      const hv = at(x, y)
      out[i + 2] = Math.round(clamp01(0.5 + (hv - 0.5) * 0.9) * 255)
      out[i + 3] = Math.round(hv * 255)
    }
  }
  return out
}
