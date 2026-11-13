// Guidance state: current objective, first-day tutorial progress and zone name cards.
// Pure zustand, no React / three.js imports. Not part of the dusk snapshot, so Retry Night
// never touches tutorial progress (design: Req 4.13, 9.7).

import { create } from 'zustand'
import type { ControlHintId } from '../../data/controlHints'
import type { TutorialStepId } from '../../data/tutorialSteps'
import { freshHintProgress, parseHintsUsed, type HintProgress } from '../systems/controlHints'
import type { ZoneId } from '../../data/zones'
import type { Objective } from '../systems/objective'
import { parseTutorial } from '../systems/tutorial'
import type { ZoneLastShown } from '../systems/zoneCardTrigger'

export interface WalkState {
  /** Metres walked on the ground plane since the first tick. */
  walked: number
  /** Last ground-plane position, or null before the first tick. */
  last: readonly [number, number] | null
}

export interface ZoneCardState {
  zone: ZoneId
  /** Seconds since the card appeared. */
  elapsed: number
}

interface GuidanceData {
  objective: Objective | null
  tutorialDone: ReadonlySet<TutorialStepId>
  walk: WalkState
  card: ZoneCardState | null
  /** Zone the player was in at the previous tick; null until the first tick. */
  zone: ZoneId | null
  zoneLastShown: ZoneLastShown
  /** Sim clock for card cooldowns; advanced by tickGuidance so pause does not run it down. */
  zoneClock: number
  /** Controls hint lines the player has already used (saved with the tutorial steps). */
  hintsUsed: ReadonlySet<ControlHintId>
  /** Distance and sprint time toward clearing the lines; not saved. */
  hintProgress: HintProgress
  /** Last ground position the hint tally saw, or null before the first tick. */
  hintLast: readonly [number, number] | null
}

interface GuidanceStoreState extends GuidanceData {
  setObjective: (o: Objective | null) => void
  setTutorialDone: (done: ReadonlySet<TutorialStepId>) => void
  /** Loads saved tutorial steps and clears every transient field. */
  restore: (steps?: unknown, hints?: unknown) => void
  setHints: (patch: Partial<Pick<GuidanceData, 'hintsUsed' | 'hintProgress' | 'hintLast'>>) => void
  reset: () => void
}

const fresh = (): GuidanceData => ({
  objective: null,
  tutorialDone: new Set(),
  walk: { walked: 0, last: null },
  card: null,
  zone: null,
  zoneLastShown: {},
  zoneClock: 0,
  hintsUsed: new Set(),
  hintProgress: freshHintProgress(),
  hintLast: null,
})

export const useGuidanceStore = create<GuidanceStoreState>((set) => ({
  ...fresh(),
  setObjective: (objective) => set({ objective }),
  setTutorialDone: (tutorialDone) => set({ tutorialDone }),
  restore: (steps, hints) =>
    set({ ...fresh(), tutorialDone: parseTutorial(steps), hintsUsed: parseHintsUsed(hints) }),
  setHints: (patch) => set(patch),
  reset: () => set(fresh()),
}))

// guidanceTick cannot import progressionStore (import cycle via introStore), so the store registers
// a probe here, like menuState's dawn-pick probe. Defaults to story until it registers.
let storyProbe: () => boolean = () => true
export const setStoryProbe = (probe: () => boolean): void => {
  storyProbe = probe
}
export const isStoryRun = (): boolean => storyProbe()
