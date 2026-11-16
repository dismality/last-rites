// A one-shot request to put the player somewhere (Retry Night, Continue, New Game).
// Writing usePlayerStore.position alone is not enough: the Rapier body is the source of truth
// while playing and the controller writes the store from it. Game code queues the move here;
// the controller consumes it once, moves the body and zeroes its fall speed.

import { sanitizeStairPosition } from '../systems/stairDescent'
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

/**
 * Queues a move to whatever the player store currently holds (call after restoring it: Continue,
 * Retry Night, Retry from morning, New Game). A restored position inside the chapel stair shaft
 * becomes the catacomb corridor, since the shaft is a dead end under the chapel (spec 09 task
 * 11n-f); the store is corrected too, or the controller would write the shaft position back.
 */
export function queueTeleportToStore(): void {
  const p = usePlayerStore.getState()
  const s = sanitizeStairPosition(p.position, p.yaw)
  if (s.moved) {
    p.setPosition(s.position)
    p.setYaw(s.yaw)
    p.setPitch(0)
  }
  queueTeleport({ position: s.position, yaw: s.yaw, pitch: s.moved ? 0 : p.pitch })
}

/** Returns the queued request and clears it, so it applies exactly once. */
export function takeTeleport(): TeleportRequest | null {
  const t = pending
  pending = null
  return t
}
