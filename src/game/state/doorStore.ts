// Chapel door barricades: built flag, board health per door and the hold-to-nail timer.
// The rules live in systems/barricade.ts; this store only holds the state.
import { create } from 'zustand'
import { DOORS } from '../../data/barricades'
import type { DoorId } from '../types'
import { buildBarricades, type NailProgress } from '../systems/barricade'

interface DoorStoreState {
  built: boolean
  /** Board health per door, lowest slot first. */
  doors: Record<DoorId, readonly number[]>
  nail: NailProgress | null
  /** Repair stage 1: fits the starting boards on both doors. Calling again resets them. */
  build: (boardHp?: number) => void
  setDoors: (doors: Record<DoorId, readonly number[]>) => void
  setNail: (nail: NailProgress | null) => void
  reset: () => void
}

const initial = () => ({
  built: false,
  doors: { front: [], vestry: [] } as Record<DoorId, readonly number[]>,
  nail: null as NailProgress | null,
})

export const useDoorStore = create<DoorStoreState>((set) => ({
  ...initial(),
  build: (boardHp = DOORS.boardHp) => {
    const b = buildBarricades(boardHp)
    set({ built: b.built, doors: b.doors, nail: null })
  },
  setDoors: (doors) => set({ doors }),
  setNail: (nail) => set({ nail }),
  reset: () => set(initial()),
}))
