// What a solved case sets off besides ending the night (spec 10, Req 2.12): the altar's clear note
// (with its subtitle), the night-cleared score events, and at dawn the stage's recipe unlocks.
// The zombies collapsing to dust is scene work (CaseCollapse). Pure wiring: no rules live here.

import { MODES } from '../../data/modes'
import { STAGE_MAP } from '../../data/stages'
import { emit, subscribeToType } from '../events'
import { statsAfterClear } from '../systems/waveDirection'
import type { RecipeId } from '../types'
import { emitCombatSound } from './combatSounds'
import { useCraftingStore } from './craftingStore'
import { useProgressionStore } from './progressionStore'
import { updateRunStats } from './statsPort'
import { stageOfNight, useStageStore } from './stageStore'
import { useWorldStore } from './worldStore'

/** Story run in progress? Endless ignores the stage store entirely. */
const storyRun = (): boolean => MODES[useProgressionStore.getState().mode].story

/** Adds a stage's dawn recipes to the unlocked list without duplicates. */
export function unlockStageRecipes(nightNumber: number): void {
  const ids = STAGE_MAP[stageOfNight(nightNumber)].dawnUnlocks
  if (ids.length === 0) return
  useCraftingStore.setState((s) => ({
    unlockedRecipes: Array.from(new Set<RecipeId>([...s.unlockedRecipes, ...ids])),
  }))
}

/** Returns the unsubscribe function. Install once, next to the other watchers. */
export function installCaseSolvedWatcher(): () => void {
  const offStage = useStageStore.subscribe((s, prev) => {
    if (!s.caseSolved || prev.caseSolved) return
    // A load or a retry restores a solved flag too; only a night in progress is a fresh solve.
    const world = useWorldStore.getState()
    if (world.phase !== 'night' || !storyRun()) return
    emitCombatSound('altar-solved')
    const night = world.nightNumber
    updateRunStats((r) => statsAfterClear(r, useProgressionStore.getState().mode, night))
    emit({ type: 'nightCleared', nightNumber: night })
  })
  const offDawn = subscribeToType('dawnStarted', (e) => {
    if (storyRun()) unlockStageRecipes(e.nightNumber)
  })
  return () => {
    offStage()
    offDawn()
  }
}
