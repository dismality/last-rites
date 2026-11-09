// Headless Chrome can never be granted pointer lock, so browser tests need a way to play without it.
// Only the dev-only debug hook (src/debug) ever sets `enabled`; a production build keeps it false.

export const lockOverride = { enabled: false }

/** True when the canvas holds the pointer, or when the dev test override says to act as if it did. */
export function isCanvasLocked(canvas: Element | null): boolean {
  if (import.meta.env.DEV && lockOverride.enabled) return true
  return canvas !== null && document.pointerLockElement === canvas
}

/** Wheel and similar code that only needs "is play locked", with no canvas at hand. */
export function isPlayLocked(): boolean {
  return (import.meta.env.DEV && lockOverride.enabled) || document.pointerLockElement !== null
}
