// Hand-off between the enemy director and the grave-gas effect (same pattern as graveBurstRuntime).
export const gasRuntime = {
  /** Ground positions where a Bloater just burst; the gas effect drains this each frame. */
  queue: [] as { x: number; z: number }[],
}

export const GAS_POOL = 96
export const GAS_LIFE_S = 1.2
const PER_BURST = 16
const BURST_RADIUS_M = 2.2

export interface GasPuff {
  x: number
  y: number
  z: number
  vx: number
  vz: number
  age: number
}

/** Fresh puffs for one burst; `rand` is injected so tests stay deterministic. */
export function spawnGas(at: { x: number; z: number }, rand: () => number): GasPuff[] {
  return Array.from({ length: PER_BURST }, () => {
    const a = rand() * Math.PI * 2
    const r = rand() * 0.6
    const speed = (BURST_RADIUS_M / GAS_LIFE_S) * (0.4 + rand() * 0.6)
    return {
      x: at.x + Math.cos(a) * r,
      y: 0.3 + rand() * 0.8,
      z: at.z + Math.sin(a) * r,
      vx: Math.cos(a) * speed,
      vz: Math.sin(a) * speed,
      age: 0,
    }
  })
}

/** Advances puffs by dt, drops expired ones and caps the pool (oldest go first). */
export function tickGas(puffs: readonly GasPuff[], dt: number): GasPuff[] {
  return puffs
    .map((p) => ({
      ...p,
      age: p.age + dt,
      x: p.x + p.vx * dt,
      z: p.z + p.vz * dt,
      y: p.y + 0.3 * dt,
    }))
    .filter((p) => p.age < GAS_LIFE_S)
    .slice(-GAS_POOL)
}
