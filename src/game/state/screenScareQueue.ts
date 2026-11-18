// Screen scare trigger queue (spec 11 H1, task 3.4). `queueScreenScare` is the API the crawler and
// the bride (task 7) call; the scripted moments are found by `tickScreenScareQueue`, which the
// game loop runs each fixed step after the enemy and scare steps. Rules: systems/screenScareQueue.
// Pure zustand glue: no React / three.js / Howler imports.
import { createRng } from '../rng'
import {
  afterAttempt,
  enqueueScare,
  inCooldown,
  markTelegraphed,
  needTelegraph,
  readyMoments,
  takeDue,
  type PendingScare,
} from '../systems/screenScareQueue'
import type { ScareKind, ScriptedMomentId } from '../systems/screenScares'
import { triggerScreenScare } from './screenScareActions'
import { useScreenScareStore } from './screenScareStore'
import { useStageStore } from './stageStore'
import { simClock } from './simClock'
import { usePlayerStore } from './playerStore'
import { useWorldStore } from './worldStore'

let queue: PendingScare[] = []
let coffinOpened = false
const rng = createRng((Math.random() * 0xffffffff) >>> 0)

/** Asks for a telegraphed screen scare. The same trigger already waiting is not added twice. */
export function queueScreenScare(kind: ScareKind, momentId?: ScriptedMomentId): void {
  queue = enqueueScare(queue, kind, momentId ?? null, simClock.now, rng)
}

/** The marked coffin's loot was taken; the coffin moment checks the player is beside it. */
export function noteCoffinOpened(): void {
  coffinOpened = true
}

export function pendingScreenScares(): readonly PendingScare[] {
  return queue
}

export function resetScreenScareQueue(): void {
  queue = []
  coffinOpened = false
}

/**
 * One fixed step: queue the scripted moments whose condition holds, play new telegraphs through
 * `onTelegraph` (the scene turns them into a flicker or a creak) and fire what is due. A due scare
 * held by an overlay keeps waiting; one inside the cooldown is dropped and its moment stays unused.
 */
export function tickScreenScareQueue(onTelegraph: (p: PendingScare) => void): void {
  const now = simClock.now
  const { scare } = useScreenScareStore.getState()

  // Scripted moments are not even telegraphed inside the cooldown or once the face is showing.
  if (scare.active === null && !inCooldown(scare.lastStartSim, now)) {
    const p = usePlayerStore.getState()
    const world = useWorldStore.getState()
    const ready = readyMoments(
      {
        stage: useStageStore.getState().stage,
        phase: world.phase,
        playerXZ: [p.position[0], p.position[2]],
        forwardXZ: [-Math.sin(p.yaw), -Math.cos(p.yaw)],
        coffinOpened,
      },
      scare.used,
    )
    for (const id of ready) queue = enqueueScare(queue, 'scripted', id, now, rng)
  }
  coffinOpened = false

  if (queue.length === 0) return
  for (const p of needTelegraph(queue)) onTelegraph(p)
  queue = markTelegraphed(queue)

  const { due, rest } = takeDue(queue, now)
  const kept: PendingScare[] = []
  for (const entry of due) {
    const outcome = triggerScreenScare(entry.kind, entry.momentId ?? undefined)
    const again = afterAttempt(entry, outcome, now)
    if (again) kept.push(again)
  }
  queue = [...rest, ...kept]
}
