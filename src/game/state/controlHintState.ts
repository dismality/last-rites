// Glue between the stores and the pure controls-hint rules. Called from GameLoop once per
// fixed step; the HUD panel only reads guidanceStore.

import { advanceHints, freshHintProgress, markHintUsed } from '../systems/controlHints'
import { useGuidanceStore } from './guidanceStore'
import { usePlayerStore } from './playerStore'
import { useSettingsStore } from './settingsStore'

/** One fixed step: tallies distance moved and time sprinted, and clears lines that are done. */
export function tickControlHints(dt: number, sprinting: boolean): void {
  const [x, , z] = usePlayerStore.getState().position
  if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(dt)) return
  const g = useGuidanceStore.getState()
  const moved = g.hintLast === null ? 0 : Math.hypot(x - g.hintLast[0], z - g.hintLast[1])
  const next = advanceHints(g.hintProgress, g.hintsUsed, { moved, dt, sprinting })
  g.setHints({
    hintLast: [x, z],
    hintProgress: next.progress,
    ...(next.used !== g.hintsUsed ? { hintsUsed: next.used } : {}),
  })
}

/** A charged heavy swing was released: the charge line has done its job. */
export function markChargeUsed(): void {
  const g = useGuidanceStore.getState()
  const used = markHintUsed(g.hintsUsed, 'charge')
  if (used !== g.hintsUsed) g.setHints({ hintsUsed: used })
}

/** Turning "Show control hints" back on shows every line again. Returns the unsubscribe. */
export function installControlHintWatchers(): () => void {
  return useSettingsStore.subscribe((s, prev) => {
    if (s.showControlHints && !prev.showControlHints) {
      useGuidanceStore.getState().setHints({ hintsUsed: new Set(), hintProgress: freshHintProgress() })
    }
  })
}
