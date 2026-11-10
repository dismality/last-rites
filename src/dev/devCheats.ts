// Cheat state for the Dev_Panel. god, noclip and timeScale are mirrored into the tiny game-side
// module (src/game/state/devCheats.ts) that the hooks read; infinite oil and stamina are done
// here by topping the stores up, so the game needs no hook for them.

import { create } from 'zustand'
import { setDevCheatFlags, resetDevCheatFlags } from '../game/state/devCheats'
import { useLanternStore } from '../game/state/lanternStore'
import { usePlayerStore } from '../game/state/playerStore'
import { useUiWorldStore } from '../game/state/uiWorldStore'

export type TimeScale = 1 | 5 | 20

export interface DevCheatState {
  god: boolean
  infiniteOil: boolean
  infiniteStamina: boolean
  noclip: boolean
  timeScale: TimeScale
}

const OFF: DevCheatState = {
  god: false,
  infiniteOil: false,
  infiniteStamina: false,
  noclip: false,
  timeScale: 1,
}

export const useDevCheatStore = create<DevCheatState>(() => ({ ...OFF }))

/** Updates the dev store and the flags the game reads. */
export function setCheats(patch: Partial<DevCheatState>): void {
  useDevCheatStore.setState(patch)
  const s = useDevCheatStore.getState()
  setDevCheatFlags({ god: s.god, noclip: s.noclip, timeScale: s.timeScale })
}

export function resetCheats(): void {
  useDevCheatStore.setState({ ...OFF })
  resetDevCheatFlags()
}

/** Health to max, oil to 100 and stamina to 100 (the "refill" button). */
export function refillAll(): void {
  const p = usePlayerStore.getState()
  p.setHealth(p.maxHealth)
  useUiWorldStore.setState({ playerHealth: p.maxHealth })
  useLanternStore.getState().setFuel(100)
  p.setStamina(100)
}

const TICKER_MS = 50

/** Keeps oil and stamina full while their cheats are on. Returns the stopper. */
export function startCheatTicker(): () => void {
  const id = setInterval(() => {
    const s = useDevCheatStore.getState()
    if (s.infiniteOil && useLanternStore.getState().fuel < 100) useLanternStore.getState().setFuel(100)
    if (s.infiniteStamina && usePlayerStore.getState().stamina < 100) usePlayerStore.getState().setStamina(100)
  }, TICKER_MS)
  return () => clearInterval(id)
}
