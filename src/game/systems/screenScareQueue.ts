// Screen scare trigger queue and scripted-moment rules (spec 11 H1, Req 1.6-1.10, 1.18).
// A request is telegraphed first (flicker, creak, breath: 0.5 to 1.5 s), then fired. While an
// overlay holds it, it waits; a skipped scripted moment is never marked used. The crawler and the
// bride (task 7) use the same `enqueueScare`. Pure TypeScript: no React, three.js or Howler.

import {
  MOMENT_SITES,
  SCREEN_SCARE_COOLDOWN_S,
  SCREEN_SCARE_QUEUE_EXPIRY_S,
  SCRIPTED_MOMENTS,
  type MomentSite,
} from '../../data/screenScares'
import type { Rng } from '../rng'
import type { Phase } from '../types'
import {
  telegraphLeadMs,
  type ScareKind,
  type ScareOutcome,
  type ScriptedMomentId,
} from './screenScares'

export interface PendingScare {
  kind: ScareKind
  momentId: ScriptedMomentId | null
  /** Sim time (s) the telegraph began. */
  telegraphAt: number
  /** Sim time (s) the face may start. */
  fireAt: number
  /** The telegraph cue has been played. */
  telegraphed: boolean
}

export const pendingKey = (p: Pick<PendingScare, 'kind' | 'momentId'>): string =>
  p.kind === 'scripted' ? `scripted:${p.momentId}` : p.kind

/** Adds a request unless the same trigger is already waiting. The face follows 0.5 to 1.5 s later. */
export function enqueueScare(
  queue: readonly PendingScare[],
  kind: ScareKind,
  momentId: ScriptedMomentId | null,
  now: number,
  rng: Rng,
): PendingScare[] {
  const entry: PendingScare = {
    kind,
    momentId: kind === 'scripted' ? momentId : null,
    telegraphAt: now,
    fireAt: now + telegraphLeadMs(rng) / 1000,
    telegraphed: false,
  }
  if (queue.some((p) => pendingKey(p) === pendingKey(entry))) return [...queue]
  return [...queue, entry]
}

/** Entries whose telegraph has not played yet. */
export function needTelegraph(queue: readonly PendingScare[]): PendingScare[] {
  return queue.filter((p) => !p.telegraphed)
}

export function markTelegraphed(queue: readonly PendingScare[]): PendingScare[] {
  return queue.map((p) => (p.telegraphed ? p : { ...p, telegraphed: true }))
}

/** Splits the queue into entries ready to fire and the rest. */
export function takeDue(
  queue: readonly PendingScare[],
  now: number,
): { due: PendingScare[]; rest: PendingScare[] } {
  const due: PendingScare[] = []
  const rest: PendingScare[] = []
  for (const p of queue) (p.fireAt <= now ? due : rest).push(p)
  return { due, rest }
}

/**
 * What happens to a due entry after `triggerScreenScare` answered. `held` waits for the overlay to
 * close (until it has waited the expiry); everything else leaves the queue. Nothing here marks a
 * moment used: only a `started` request does, inside `requestScreenScare`.
 */
export function afterAttempt(entry: PendingScare, outcome: ScareOutcome, now: number): PendingScare | null {
  if (outcome !== 'held') return null
  return now - entry.fireAt > SCREEN_SCARE_QUEUE_EXPIRY_S ? null : entry
}

/** True while a scare that started at `lastStartSim` still blocks new ones (the 180 s cooldown). */
export function inCooldown(lastStartSim: number | null, now: number): boolean {
  return lastStartSim !== null && now - lastStartSim < SCREEN_SCARE_COOLDOWN_S
}

// ---------------------------------------------------------------------------------------------
// Scripted moments.

export interface MomentContext {
  stage: 1 | 2 | 3
  phase: Phase
  playerXZ: readonly [number, number]
  /** Look direction on the ground plane (unit). */
  forwardXZ: readonly [number, number]
  /** The marked coffin's loot was just taken (an event, so true for one check only). */
  coffinOpened: boolean
}

function siteReached(site: MomentSite, ctx: MomentContext): boolean {
  const dx = site.position[0] - ctx.playerXZ[0]
  const dz = site.position[1] - ctx.playerXZ[1]
  if (Math.hypot(dx, dz) > site.radius) return false
  if (!site.facing) return true
  const f = ctx.forwardXZ
  const len = Math.hypot(f[0], f[1])
  if (len === 0) return false
  const dot = (f[0] * site.facing[0] + f[1] * site.facing[1]) / len
  return dot >= Math.cos(((site.facingConeDeg ?? 0) * Math.PI) / 180)
}

/** Scripted moments whose condition holds now and that have not played in this save. */
export function readyMoments(ctx: MomentContext, used: ReadonlySet<ScriptedMomentId>): ScriptedMomentId[] {
  const out: ScriptedMomentId[] = []
  for (const m of SCRIPTED_MOMENTS) {
    if (used.has(m.id)) continue
    if (m.stage !== undefined && m.stage !== ctx.stage) continue
    if (m.nightOnly && ctx.phase !== 'night') continue
    const site = MOMENT_SITES[m.id]
    if (m.id === 'coffin-night-2') {
      if (!ctx.coffinOpened || !siteReached(site, ctx)) continue
    } else if (!siteReached(site, ctx)) continue
    out.push(m.id)
  }
  return out
}
