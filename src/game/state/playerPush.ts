// A one-shot shove on the player (the Toll's 3 m push). The character controller owns the
// body and Rapier owns the walls, so game code only queues the displacement; the controller
// consumes it and moves the body so a wall still stops the push.

export interface PlayerPush {
  x: number
  z: number
}

let pending: PlayerPush | null = null

/** Queues a push of `distM` metres along (dx, dz). Zero or non-finite directions queue nothing. */
export function queuePlayerPush(dx: number, dz: number, distM: number): void {
  const len = Math.hypot(dx, dz)
  if (!Number.isFinite(len) || len === 0 || !(distM > 0)) return
  pending = { x: (dx / len) * distM, z: (dz / len) * distM }
}

/** Returns the queued push and clears it. */
export function takePlayerPush(): PlayerPush | null {
  const p = pending
  pending = null
  return p
}
