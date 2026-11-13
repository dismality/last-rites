// Glue between the stores and the pure guidance rules (objective, tutorial, zone cards).
// Called once per fixed step from GameLoop; reads stores, never holds game rules itself.

import { DAY_DURATION_S, DUSK_DURATION_S } from '../../data/balance'
import { ITEM_MAP } from '../../data/items'
import { ENDLESS } from '../../data/modes'
import { RELICS } from '../../data/relics'
import { DIG_STEP_ID, TUTORIAL_PICKUP_ITEM, type TutorialAction } from '../../data/tutorialSteps'
import { FIXED_SPAWNS, SPAWN_POINTS } from '../../data/zones'
import { ZONE_CARD_SHOW_S } from '../../data/zoneCards'
import { subscribeToType } from '../events'
import { craneFighting } from '../systems/bossDirector'
import { countRelics, riteAvailability } from '../systems/finalRite'
import { cellAt, isExplored } from '../systems/mapReveal'
import {
  selectObjective,
  type Objective,
  type ObjectiveInput,
  type Vec3,
} from '../systems/objective'
import { withDigTutorialMarker } from '../systems/digGuidance'
import {
  currentTutorialStep,
  markActionDone,
  isWalkComplete,
  tutorialPrompt,
  walkStep,
} from '../systems/tutorial'
import { zoneAt } from '../systems/zoneAt'
import { recordZoneCard, shouldShowZoneCard } from '../systems/zoneCardTrigger'
import { useBossStore } from './bossStore'
import { riteFinalNight } from './riteStatus'
import { useEndingStore } from './endingStore'
import { useEnemyStore } from './enemyStore'
import { isStoryRun, useGuidanceStore } from './guidanceStore'
import { useInventoryStore } from './inventoryStore'
import { useMapStore } from './mapStore'
import { useMysteryStore } from './mysteryStore'
import { usePlayerStore } from './playerStore'
import { useSettingsStore } from './settingsStore'
import { useSpawnStore } from './spawnStore'
import { useStageStore } from './stageStore'
import { useWaveStore } from './waveStore'
import { useWorldStore } from './worldStore'

/** Relic sites not yet collected whose map cell is explored (no spoilers, pillar 3). */
const exploredRelicSites = (): Vec3[] => {
  const inv = useInventoryStore.getState().inventory
  const mystery = useMysteryStore.getState().mystery
  const taken = useSpawnStore.getState().world.collectedFixed
  const map = useMapStore.getState().map
  const sites: Vec3[] = []
  for (const relic of RELICS) {
    if (inv.relics.includes(relic.id) || mystery.relics.has(relic.id)) continue
    const spawn = FIXED_SPAWNS.find((f) => f.id === relic.location)
    // Night-only relics cannot be found by day, so they are never a day objective.
    if (!spawn || spawn.nightOnly || taken.includes(spawn.id)) continue
    const c = cellAt(spawn.position[0], spawn.position[2])
    if (isExplored(map, c.cx, c.cz)) sites.push(spawn.position)
  }
  return sites
}

export const readObjectiveInput = (): ObjectiveInput => {
  const world = useWorldStore.getState()
  const inv = useInventoryStore.getState().inventory
  const mystery = useMysteryStore.getState().mystery
  const waves = useWaveStore.getState()
  const player = usePlayerStore.getState()
  const relics = countRelics(inv.relics, mystery.relics)
  const availability = riteAvailability({
    nightNumber: world.nightNumber,
    phase: world.phase,
    wavesCleared: useEndingStore.getState().nightFiveCleared,
    relicCount: relics,
    finalNight: riteFinalNight(),
  })
  const story = isStoryRun()
  const phaseLength =
    world.phase === 'dusk' ? DUSK_DURATION_S : story ? DAY_DURATION_S : ENDLESS.dayS
  const living = useEnemyStore
    .getState()
    .enemies.filter((e) => e.state !== 'dying' && e.state !== 'dead').length
  return {
    phase: world.phase,
    nightNumber: world.nightNumber,
    secondsLeft: Math.max(0, phaseLength - world.phaseTime),
    waves: {
      running: world.phase === 'night' && waves.waves.phase !== 'done',
      index: waves.waves.waveIndex + 1,
      total: waves.totalWaves,
      zombiesLeft: living,
    },
    rite: {
      // Story waves never end, so the rite is offered as soon as it can start (until task 4).
      available: availability === 'ready' && (useEndingStore.getState().nightFiveCleared || story),
      running: mystery.riteProgress > 0 || useEndingStore.getState().riteStarted,
      // Only while he is on the field; before he rises or after he falls the rite line shows.
      craneAlive: craneFighting(useBossStore.getState().boss),
    },
    // Rule 12 (spec 09, F1): only the starting shovel counts as "no weapon yet".
    needsWeapon: !inv.slots.some(
      (s) => ITEM_MAP[s.item]?.kind === 'weapon' && s.item !== 'rusty-shovel',
    ),
    progress: {
      page1Read: mystery.pages.has(1),
      cryptKey: inv.keyItems.includes('rusted-crypt-key'),
      whistle: inv.keyItems.includes('bone-whistle'),
      stairRevealed: mystery.gates.catacombs,
      ossuaryKey: inv.keyItems.includes('iron-ossuary-key'),
      relics,
    },
    relicSites: exploredRelicSites(),
    playerPos: player.position,
    story,
    ...(story ? { stage: readStageInput() } : {}),
  }
}

/** Stage block of the objective input: curse links (case board, task 2), the altar lock. */
const readStageInput = (): NonNullable<ObjectiveInput['stage']> => {
  const s = useStageStore.getState()
  return {
    stage: s.stage,
    // The case board does not exist yet (task 2): no correct links can have been made.
    curseLinks: 0,
    altarLockedS: Math.max(0, Math.ceil(s.altar.lockedUntil - s.nightElapsed)),
  }
}

const sameObjective = (a: Objective | null, b: Objective): boolean =>
  a !== null &&
  a.rule === b.rule &&
  a.main === b.main &&
  a.second === b.second &&
  a.marker === b.marker &&
  a.curse?.value === b.curse?.value &&
  a.position?.[0] === b.position?.[0] &&
  a.position?.[2] === b.position?.[2]

/** True while the dig tutorial prompt is the one on screen. */
const digTutorialActive = (): boolean => {
  const s = useSettingsStore.getState()
  const world = useWorldStore.getState()
  if (!s.tutorialPrompts || world.phase !== 'day' || world.nightNumber !== 1) return false
  return currentTutorialStep(useGuidanceStore.getState().tutorialDone) === DIG_STEP_ID
}

/** Recomputes the objective now; writes only on change so subscribers stay quiet. */
export const refreshGuidance = (): void => {
  const input = readObjectiveInput()
  const next = withDigTutorialMarker(
    selectObjective(input),
    digTutorialActive(),
    input.playerPos,
    // Read from data (not digStore) to keep guidance free of the progression import cycle.
    SPAWN_POINTS.filter((p) => p.lootTable === 'grave-dig').map((p) => p.position),
  )
  const store = useGuidanceStore.getState()
  if (!sameObjective(store.objective, next)) store.setObjective(next)
}

/** The tutorial prompt for the current state, or null. The tracker renders this. */
export const readTutorialPrompt = (): string | null => {
  const world = useWorldStore.getState()
  const s = useSettingsStore.getState()
  return tutorialPrompt({
    done: useGuidanceStore.getState().tutorialDone,
    enabled: s.tutorialPrompts,
    phase: world.phase,
    nightNumber: world.nightNumber,
    bindings: s.bindings,
  })
}

const completeAction = (action: TutorialAction): void => {
  const store = useGuidanceStore.getState()
  const next = markActionDone(store.tutorialDone, action)
  if (next !== store.tutorialDone) store.setTutorialDone(next)
}

/** One fixed step. A non-finite player position skips the whole tick. */
export const tickGuidance = (dt: number): void => {
  const [x, y, z] = usePlayerStore.getState().position
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z) || !Number.isFinite(dt))
    return
  const step = Math.max(0, dt)

  const s = useGuidanceStore.getState()
  const now = s.zoneClock + step
  const patch: Partial<ReturnType<typeof useGuidanceStore.getState>> = { zoneClock: now }

  // Walk tally for tutorial step 1.
  const walk = walkStep(s.walk.walked, s.walk.last, [x, z])
  patch.walk = { walked: walk, last: [x, z] }

  // Zone cards: a new card replaces a showing one; only recordZoneCard moves the cooldown.
  const zone = zoneAt(x, z)
  let card = s.card ? { ...s.card, elapsed: s.card.elapsed + step } : null
  if (card && card.elapsed >= ZONE_CARD_SHOW_S) card = null
  let lastShown = s.zoneLastShown
  if (shouldShowZoneCard(s.zone, zone, now, lastShown)) {
    lastShown = recordZoneCard(lastShown, zone, now)
    card = { zone, elapsed: 0 }
  }
  patch.zone = zone
  patch.zoneLastShown = lastShown
  patch.card = card
  useGuidanceStore.setState(patch)

  if (isWalkComplete(walk)) completeAction('walk')
  refreshGuidance()
}

/** Subscribes tutorial completion to game events and journal page 1. Returns the unsubscribe. */
export const installGuidanceWatchers = (): (() => void) => {
  const offs = [
    // Step 2 is "pick up the oil": any other pickup must not skip it (spec 09, B4 and F1).
    subscribeToType('itemCollected', (e) => {
      if (e.itemId === TUTORIAL_PICKUP_ITEM) completeAction('pickup')
    }),
    subscribeToType('digCompleted', () => completeAction('dig')),
    subscribeToType('craftCompleted', () => completeAction('craft')),
    subscribeToType('hotbarBound', () => completeAction('bindHotbar')),
    subscribeToType('journalOpened', () => completeAction('openJournal')),
    useMysteryStore.subscribe((state, prev) => {
      if (state.mystery !== prev.mystery && state.mystery.pages.has(1)) {
        completeAction('readPage')
        refreshGuidance()
      }
    }),
  ]
  return () => offs.forEach((off) => off())
}
