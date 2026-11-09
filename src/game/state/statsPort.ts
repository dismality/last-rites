// Lets endingStore transform the run stats without importing progressionStore, which would form
// an import cycle through menuState. progressionStore registers itself on load.
import type { RunStats } from '../systems/runStats'

export interface StatsPort {
  get: () => RunStats
  set: (s: RunStats) => void
}

let port: StatsPort | null = null

export function registerStatsPort(p: StatsPort): void {
  port = p
}

export function updateRunStats(f: (s: RunStats) => RunStats): void {
  if (port) port.set(f(port.get()))
}
