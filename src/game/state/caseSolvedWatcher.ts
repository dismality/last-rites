// What a solved case sets off besides ending the night (spec 10, Req 2.12): the altar's clear note
// (with its subtitle), the night-cleared score events, and at dawn the stage's recipe unlocks.
// The zombies collapsing to dust is scene work (CaseCollapse). Pure wiring: no rules live here.

import { caseOfStage, CASE_1_REWARD } from '../../data/cases'
import { MODES } from '../../data/modes'
import { useCaseStore } from './caseStore'
import { useChapelStore } from './chapelStore'
import { STAGE_MAP } from '../../data/stages'
import { emit, subscribeToType } from '../events'
import { statsAfterClear } from '../systems/waveDirection'
import type { RecipeId } from '../types'
import { emitCombatSound } from './combatSounds'
import { useCraftingStore } from './craftingStore'
import { useProgressionStore } from './progressionStore'
import { FIXED_SPAWNS } from '../../data/zones'
import { useInventoryStore } from './inventoryStore'
import { useSpawnStore } from './spawnStore'
import { useToastStore } from './toastStore'
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

/**
 * Case 1 reward (Req 14.4): the altar hands over the Rusted Crypt Key the moment the name is
 * accepted (playtest, 2026-11-27: no search). It goes straight into the journal's key items, and
 * its world copy in Pell's grave is marked taken so it never lies there too.
 */
export function markCase1Reward(): void {
  useInventoryStore.getState().addKeyItem(CASE_1_REWARD.item)
  const spawns = useSpawnStore.getState()
  const id = FIXED_SPAWNS.find((f) => f.item === CASE_1_REWARD.item)?.id
  if (id && !spawns.world.collectedFixed.includes(id))
    spawns.setWorld({ ...spawns.world, collectedFixed: [...spawns.world.collectedFixed, id] })
  useToastStore.getState().push('The altar gives up the Rusted Crypt Key. It opens the Mausoleum Row gate.')
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
    // After the score event, which reads this case's hints and wrong answers for Sharp Eye.
    const solved = caseOfStage(stageOfNight(night))
    useCaseStore.getState().closeCase(solved.id)
    if (solved.id === 'saved-by-the-bell') markCase1Reward()
  })
  const offDawn = subscribeToType('dawnStarted', (e) => {
    // The altar heals once per visit per day (design bible §2); nothing else cleared the flag.
    useChapelStore.getState().resetDailyState()
    if (storyRun()) unlockStageRecipes(e.nightNumber)
  })
  return () => {
    offStage()
    offDawn()
  }
}
