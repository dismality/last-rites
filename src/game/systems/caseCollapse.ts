// A solved case ends the night: every living zombie collapses to dust (spec 10, Req 2.12).
// Pure TS. The scene turns the returned positions into dust puffs; nothing here is gore.

import { COLLAPSE_DUST_PUFFS, COLLAPSE_DUST_PUFFS_CALM } from '../../data/stages'
import type { AIEnemy } from './enemyAI'

export interface CollapseResult {
  enemies: readonly AIEnemy[]
  /** Ground positions where a zombie turned to dust, one per zombie that collapsed. */
  collapsed: readonly { x: number; z: number }[]
}

/**
 * Puts every living zombie into the dying state (the normal fade-out and removal then run).
 * Dying and dead zombies are left alone. Father Crane is not a wave zombie: the rite ends him.
 * No `enemyCollapsed` event is raised, so a collapse scores nothing and drops nothing.
 */
export function collapseLiving(enemies: readonly AIEnemy[]): CollapseResult {
  const collapsed: { x: number; z: number }[] = []
  const next = enemies.map((e) => {
    if (e.state === 'dying' || e.state === 'dead' || e.type === 'father-crane') return e
    collapsed.push({ x: e.pos.x, z: e.pos.z })
    return { ...e, hp: 0, state: 'dying' as const, stateTime: 0, stagger: 0, knockdown: 0, investigate: null }
  })
  return { enemies: collapsed.length === 0 ? enemies : next, collapsed }
}

/** Calm players (shake or flashing lights off, or reduced motion) get one soft puff per zombie. */
export function collapsePuffCount(calm: boolean): number {
  return calm ? COLLAPSE_DUST_PUFFS_CALM : COLLAPSE_DUST_PUFFS
}
