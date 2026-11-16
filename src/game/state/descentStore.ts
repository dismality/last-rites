// State of the chapel-stair descent (spec 09 task 11n-f): the black overlay's opacity and whether
// input is locked (only while the screen is fully black). Written by scene/world/StairDescent.tsx.

import { create } from 'zustand'

interface DescentState {
  opacity: number
  locked: boolean
  set: (opacity: number, locked: boolean) => void
}

export const useDescentStore = create<DescentState>((set) => ({
  opacity: 0,
  locked: false,
  set: (opacity, locked) => set({ opacity, locked }),
}))
