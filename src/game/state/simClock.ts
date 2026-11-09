// Simulation time in seconds. A plain object advanced only by the progression tick,
// so pause and menus freeze it and timers built on it never drift from the sim.

export const simClock = { now: 0 }

/** Advance the clock by one fixed step. Only the progression tick calls this. */
export function stepSimClock(dt: number): void {
  simClock.now += dt
}

export function resetSimClock(): void {
  simClock.now = 0
}
