// Thrown items in flight plus placed traps and salt circles.
// Scene components tick and render them; the rules are in systems/projectiles.ts.
import { create } from 'zustand'
import type { ThrowableId } from '../../data/projectiles'
import type { SaltCircle, Trap, Vec3 } from '../systems/projectiles'

export interface ThrownItem {
  id: string
  kind: ThrowableId
  origin: Vec3
  velocity: Vec3
}

interface ProjectileStoreState {
  thrown: readonly ThrownItem[]
  traps: readonly Trap[]
  salts: readonly SaltCircle[]
  addThrown: (t: ThrownItem) => void
  removeThrown: (id: string) => void
  setTraps: (traps: readonly Trap[]) => void
  setSalts: (salts: readonly SaltCircle[]) => void
  /** Clears everything, e.g. at dawn or on Retry Night. */
  reset: () => void
}

export const useProjectileStore = create<ProjectileStoreState>((set) => ({
  thrown: [],
  traps: [],
  salts: [],
  addThrown: (t) => set((s) => ({ thrown: [...s.thrown, t] })),
  removeThrown: (id) => set((s) => ({ thrown: s.thrown.filter((t) => t.id !== id) })),
  setTraps: (traps) => set({ traps }),
  setSalts: (salts) => set({ salts }),
  reset: () => set({ thrown: [], traps: [], salts: [] }),
}))
