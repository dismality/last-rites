// Grab kill-cam state (spec 10 task 8, Req 25). Pure zustand; the actions are in killCamActions.ts.

import { create } from 'zustand'
import type { EnemyId } from '../../data/enemies'
import type { GrabPlan } from '../systems/killCam'
import type { HurtSource } from './retryNight'

export interface ActiveGrab {
  enemy: EnemyId
  at: { x: number; z: number }
  startS: number
  plan: GrabPlan
  damage: number
  source: HurtSource
  from: { yaw: number; pitch: number }
  to: { yaw: number; pitch: number }
}

interface KillCamStoreState {
  lastStartS: number | null
  active: ActiveGrab | null
  /** The red edge: when it started and how it shows. */
  edge: { startS: number; kind: GrabPlan['edge'] } | null
  /** Kill-cams started this run (dev and tests). */
  count: number
  reset: () => void
}

export const useKillCamStore = create<KillCamStoreState>((set) => ({
  lastStartS: null,
  active: null,
  edge: null,
  count: 0,
  reset: () => set({ lastStartS: null, active: null, edge: null, count: 0 }),
}))
