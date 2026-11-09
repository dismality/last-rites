// A one-shot request to put the player somewhere (Retry Night, Continue, New Game).
// Writing usePlayerStore.position alone is not enough: the Rapier body is the source of truth
// while playing and the controller writes the store from it. Game code queues the move here;
// the controller consumes it once, moves the body and zeroes its fall speed.

import { usePlayerStore } from './playerStore'

export interface TeleportRequest {
  /** Feet position [x, y, z]. */
  position: [number, number, number]
  yaw: number
  pitch: number
}

let pending: TeleportRequest | null = null

export function queueTeleport(req: TeleportRequest): void {
  pending = { position: [...req.position], yaw: req.yaw, pitch: req.pitch }
}

/** Queues a move to whatever the player store currently holds (call after restoring it). */
export function queueTeleportToStore(): void {
  const { position, yaw, pitch } = usePlayerStore.getState()
  queueTeleport({ position, yaw, pitch })
}

/** Returns the queued request and clears it, so it applies exactly once. */
export function takeTeleport(): TeleportRequest | null {
  const t = pending
  pending = null
  return t
}
