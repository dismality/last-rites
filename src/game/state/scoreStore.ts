// Night-scoped score state: combo, kill de-dup and the counters the night summary and
// achievements read. Cleared at nightStarted and by clearNightState (Night_State).
import { create } from 'zustand'
import { COMBO } from '../../data/scoring'

export interface ScoreStoreFields {
  combo: number
  lastKillAt: number | null
  seen: string[]
  nightKillPoints: number
  nightDamage: number
  nightHeadshotKills: number
  nightKills: number
  nightItems: number
  clearHp: number | null
}

interface ScoreStoreState extends ScoreStoreFields {
  patch: (p: Partial<ScoreStoreFields>) => void
  resetNight: () => void
}

const initial = (): ScoreStoreFields => ({
  combo: COMBO.base,
  lastKillAt: null,
  seen: [],
  nightKillPoints: 0,
  nightDamage: 0,
  nightHeadshotKills: 0,
  nightKills: 0,
  nightItems: 0,
  clearHp: null,
})

export const useScoreStore = create<ScoreStoreState>((set) => ({
  ...initial(),
  patch: (p) => set(p),
  resetNight: () => set(initial()),
}))
