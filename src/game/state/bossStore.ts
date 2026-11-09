// Father Crane's state machine data. Transitions are in systems/bossDirector.ts.
import { create } from 'zustand'
import { initialBoss, type BossState } from '../systems/bossDirector'

interface BossStoreState {
  boss: BossState
  setBoss: (boss: BossState) => void
  /** Not risen, phase 1, timers zero, riteClock 0. */
  reset: () => void
}

export const useBossStore = create<BossStoreState>((set) => ({
  boss: initialBoss(),
  setBoss: (boss) => set({ boss }),
  reset: () => set({ boss: initialBoss() }),
}))
