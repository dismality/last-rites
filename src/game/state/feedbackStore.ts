// Combat feedback shown on screen: hit marker, floating damage numbers and the "too tired" cue.
import { create } from 'zustand'
import { DAMAGE_NUMBER } from '../../data/combatFeedback'
import type { DamageNumber } from '../systems/damageNumbers'
import type { HitMarkerState } from '../systems/hitMarker'

interface FeedbackStoreState {
  marker: HitMarkerState | null
  numbers: readonly DamageNumber[]
  nextNumberId: number
  tooTired: boolean
  setMarker: (marker: HitMarkerState | null) => void
  /** Keeps only the newest DAMAGE_NUMBER.max entries. */
  setNumbers: (numbers: readonly DamageNumber[], nextNumberId?: number) => void
  setTooTired: (tooTired: boolean) => void
  clear: () => void
}

const initial = () => ({
  marker: null as HitMarkerState | null,
  numbers: [] as readonly DamageNumber[],
  nextNumberId: 1,
  tooTired: false,
})

export const useFeedbackStore = create<FeedbackStoreState>((set) => ({
  ...initial(),
  setMarker: (marker) => set({ marker }),
  setNumbers: (numbers, nextNumberId) =>
    set((s) => ({
      numbers: numbers.slice(-DAMAGE_NUMBER.max),
      nextNumberId: nextNumberId ?? s.nextNumberId,
    })),
  setTooTired: (tooTired) => set({ tooTired }),
  clear: () => set(initial()),
}))
