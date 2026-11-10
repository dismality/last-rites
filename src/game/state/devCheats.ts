// The one place the game reads developer cheats. Every flag defaults to off and only code in
// src/dev/ (loaded with ?dev=1 or in a DEV build) ever writes it, so production play never sees
// a cheat. Kept as a plain object, not a zustand store: the hooks that read it run every frame.
// Pure TypeScript, no React / three.js imports.

export interface DevCheatFlags {
  /** hurtPlayer deals nothing. */
  god: boolean
  /** The player controller skips collision and gravity. */
  noclip: boolean
  /** Whole fixed ticks run per normal tick (1 = real time). */
  timeScale: number
  /**
   * The Dev_Panel is open and holds the cursor. Counted as an overlay (menuState), so input and
   * the controller stop and releasing pointer lock does not pause the game under the panel.
   */
  panelOpen: boolean
}

const OFF: DevCheatFlags = { god: false, noclip: false, timeScale: 1, panelOpen: false }

const flags: DevCheatFlags = { ...OFF }

/** Live flags. Read-only here: only src/dev/ calls setDevCheatFlags. */
export function getDevCheats(): Readonly<DevCheatFlags> {
  return flags
}

/** Whole ticks per frame tick: never below 1, so a bad value cannot stall the sim. */
export function devTimeScaleTicks(): number {
  const n = Math.round(flags.timeScale)
  return Number.isFinite(n) && n >= 1 ? n : 1
}

export function setDevCheatFlags(patch: Partial<DevCheatFlags>): void {
  Object.assign(flags, patch)
}

export function resetDevCheatFlags(): void {
  Object.assign(flags, OFF)
}
