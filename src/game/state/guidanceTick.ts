// Glue between the stores and the pure guidance rules (objective, tutorial, zone cards).
// Called once per fixed step from GameLoop; reads stores, never holds game rules itself.

import { DAY_DURATION_S, DUSK_DURATION_S } from '../../data/balance'
import { crestTabletPosition, EVIDENCE_SEARCH, STAGE_DAY_RULES } from '../../data/objectiveRules'
import { caseOfStage, CASE_1_BELLS, CASE_1_RIGHT_FLAGS, CASE_1_STONES, CASE_2_CREST_LOCK, CASE_3_BOOTS_CLUE, type EvidenceCardId, type MinigameId } from '../../data/cases'
import { useGameStore } from './gameStore'
import { stepAnnouncements, type StepWatch } from '../systems/stageSteps'
import { useClueRevealStore } from './clueRevealStore'
import { ITEM_MAP } from '../../data/items'
import { ENDLESS } from '../../data/modes'
import { RELICS } from '../../data/relics'
import { DIG_STEP_ID, TUTORIAL_PICKUP_ITEM, type TutorialAction } from '../../data/tutorialSteps'
import { FIXED_SPAWNS, SPAWN_POINTS } from '../../data/zones'
import { ZONE_CARD_SHOW_S } from '../../data/zoneCards'
import { subscribeToType } from '../events'
import { craneFighting } from '../systems/bossDirector'
import { installControlHintWatchers } from './controlHintState'
import { countRelics, riteAvailability } from '../systems/finalRite'
import { cellAt, isExplored } from '../systems/mapReveal'
import { redirectViaStair } from '../systems/stairDescent'
import {
  selectObjective,
  stageReadyForDusk,
  type Objective,
  type ObjectiveInput,
  type Vec3,
} from '../systems/objective'
import { withDigTutorialMarker } from '../systems/digGuidance'
import { hintNear, hintPlacePosition } from '../systems/objectiveHint'
import {
  currentTutorialPlace,
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
import { isStoryRun, modeDayLengthS, useGuidanceStore } from './guidanceStore'
import { useInventoryStore } from './inventoryStore'
import { useMapStore } from './mapStore'
import { useMysteryStore } from './mysteryStore'
import { usePlayerStore } from './playerStore'
import { useSettingsStore } from './settingsStore'
import { useSpawnStore } from './spawnStore'
import { useStageStore } from './stageStore'
import { useHunchStore } from './hunchStore'
import { hunchTarget, tickHunchClock, type HunchCandidate } from '../systems/keeperHunch'
import { selectCorrectLinks, useCaseStore } from './caseStore'
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
    finalNight: riteFinalNight(),
  })
  const story = isStoryRun()
  const phaseLength =
    world.phase === 'dusk'
      ? DUSK_DURATION_S
      : (modeDayLengthS() ?? (story ? DAY_DURATION_S : ENDLESS.dayS))
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
      // Story waves never end, so the rite is offered for the whole of stage 3's night.
      available: availability === 'ready' && story,
      // The first placed relic sets riteStarted; the night's end clears it with the altar.
      running: useEndingStore.getState().riteStarted,
      // Only while he is on the field; before he rises or after he falls the rite line shows.
      craneAlive: craneFighting(useBossStore.getState().boss),
    },
    // Rule 12 (spec 09, F1): only the starting shovel counts as "no weapon yet".
    needsWeapon: !hasRealWeapon(),
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
    curseLinks: selectCorrectLinks(useCaseStore.getState(), s.stage),
    linksTotal: caseOfStage(s.stage).notes.length,
    altarLockedS: Math.max(0, Math.ceil(s.altar.lockedUntil - s.nightElapsed)),
    day: readStageDaySteps(s.stage),
  }
}

/** By day in a story run, the case is ready for the altar: its bell may call the dusk early. */
export const earlyDuskReady = (): boolean =>
  isStoryRun() &&
  useGameStore.getState().screen === 'game' &&
  useWorldStore.getState().phase === 'day' &&
  stageReadyForDusk(readStageInput())

/** Announces finished steps for the current story stage; call once per guidance refresh. */
const watchStageSteps = (story: boolean): void => {
  // Off the game screen (title, death, a load) forget what was seen, so a Continue or a Retry
  // never announces steps that were already done.
  if (useGameStore.getState().screen !== 'game') return resetStepWatch()
  if (!story) return
  const s = useStageStore.getState()
  announceSteps(s.stage, readStageDaySteps(s.stage))
}

/**
 * Where the stage's unfound clues are (spec 10, keeper's hunch): its walk clues not yet picked up,
 * and the station of each unsolved minigame (its stage day step's place, same order as the case's
 * minigames). The bells count once each until 1b is solved. The relics are not clues.
 */
const readHunchCandidates = (stage: 1 | 2 | 3): HunchCandidate[] => {
  const def = caseOfStage(stage)
  const progress = useCaseStore.getState().cases[def.id]
  const out: HunchCandidate[] = []
  for (const c of def.clues) {
    if (c.found.kind === 'walk' && !progress.found.includes(c.id)) out.push({ id: c.id, position: c.found.position })
  }
  const rules = STAGE_DAY_RULES[stage]
  def.minigames.forEach((m) => {
    if (progress.minigames.includes(m)) return
    const place = rules.find((r) => r.minigame === m)?.place
    if (place?.kind === 'point') out.push({ id: m, position: place.at })
    else if (place?.kind === 'nearest') {
      const bells = m === '1b' ? CASE_1_BELLS.filter((b) => !progress.bellsExamined.includes(b.id)) : []
      const at = bells.length > 0 ? bells.map((b) => b.position) : place.at
      at.forEach((p, i) => out.push({ id: `${m}-${i}`, position: p }))
    }
  })
  return out
}

/** One step of the keeper's hunch: day play since the last clue, and the clue the flame leans to. */
const tickHunch = (dt: number): void => {
  const h = useHunchStore.getState()
  const phase = useWorldStore.getState().phase
  const found = Object.values(useCaseStore.getState().cases).reduce((n, p) => n + p.found.length, 0)
  const clock = tickHunchClock(h.clock, dt, phase, found)
  const story = isStoryRun()
  const cands = story ? readHunchCandidates(useStageStore.getState().stage) : []
  h.set(clock, hunchTarget(clock, phase, cands, usePlayerStore.getState().position))
}

/** Progress on the stage's day steps, in `STAGE_DAY_RULES` order (spec 10, design bible §11). */
type DayStep = { count: number; done: boolean; at?: readonly (readonly [number, number, number])[] }

const ALL_CARDS: readonly EvidenceCardId[] = Object.keys(EVIDENCE_SEARCH) as EvidenceCardId[]

/**
 * Progress on the stage's day steps, in `STAGE_DAY_RULES` order (spec 10, design bible §11). A
 * step with several things to do points at the nearest one not yet done (`at`).
 */
const readStageDaySteps = (stage: 1 | 2 | 3): DayStep[] => {
  const cases = useCaseStore.getState().cases
  const solved = (id: MinigameId) => caseOfStage(stage).minigames.includes(id) && cases[caseOfStage(stage).id].minigames.includes(id)
  const one = (id: MinigameId) => ({ count: solved(id) ? 1 : 0, done: solved(id) })
  if (stage === 1) {
    const c1 = cases['saved-by-the-bell']
    const examined = c1.bellsExamined
    const left = CASE_1_BELLS.filter((b) => !examined.includes(b.id)).map((b) => b.position)
    const graves = CASE_1_RIGHT_FLAGS.map((f) => CASE_1_STONES.find((st) => st.id === f.stoneId)!)
    const unread = graves.filter((g) => !c1.stonesRead.includes(g.id))
    const stonesDone = solved('1a') || unread.length === 0
    const marked = c1.ledgerLines.filter((l) => l.flag !== null).length
    return [
      {
        count: stonesDone ? graves.length : graves.length - unread.length,
        done: stonesDone,
        ...(unread.length > 0 && !stonesDone ? { at: unread.map((g) => g.position) } : {}),
      },
      { count: solved('1a') ? graves.length : Math.min(graves.length, marked), done: solved('1a') },
      { count: solved('1b') ? 3 : Math.min(3, examined.length), done: solved('1b'), ...(left.length > 0 ? { at: left } : {}) },
    ]
  }
  if (stage === 2) {
    // The case lies behind the Mausoleum Row gate: first its key (Pell's grave), then the gate,
    // then the tablets that the crest lock needs.
    const gateOpen = useMysteryStore.getState().mystery.gates['mausoleum-row']
    const hasKey = gateOpen || useInventoryStore.getState().inventory.keyItems.includes('rusted-crypt-key')
    const flag = (done: boolean) => ({ count: done ? 1 : 0, done })
    const read = cases['resurrection-men'].tabletsRead
    const tablets = CASE_2_CREST_LOCK.tablets
    const tabletsDone = solved('2a') || tablets.every((t) => read.includes(t.family))
    const unread = tablets.filter((t) => !read.includes(t.family)).map(crestTabletPosition)
    return [
      flag(hasKey),
      flag(gateOpen),
      {
        count: tabletsDone ? tablets.length : Math.min(tablets.length, read.length),
        done: tabletsDone,
        ...(unread.length > 0 ? { at: unread } : {}),
      },
      one('2a'),
      one('2b'),
      one('2c'),
    ]
  }
  const inv = useInventoryStore.getState().inventory
  const relics = countRelics(inv.relics, useMysteryStore.getState().mystery.relics)
  // Elias's evidence: the cards examined, and the dry boots through their hut clue.
  const found = new Set<EvidenceCardId>(cases['sealed-catacombs'].evidenceFound)
  if (useMysteryStore.getState().mystery.clues.has(CASE_3_BOOTS_CLUE)) found.add('dry-boots')
  const cardsDone = solved('3b') || found.size >= ALL_CARDS.length
  const missing = ALL_CARDS.filter((c) => !found.has(c)).map((c) => EVIDENCE_SEARCH[c])
  return [
    one('3a'),
    { count: cardsDone ? ALL_CARDS.length : found.size, done: cardsDone, ...(missing.length > 0 ? { at: missing } : {}) },
    one('3b'),
    { count: relics, done: relics >= 5 },
  ]
}

/** Last stage steps seen, so a step that finishes is announced once (`stepAnnouncements`). */
let stepWatch: StepWatch | null = null

/** Forget the steps seen (a new run, a load), so nothing is announced for what was already done. */
export const resetStepWatch = (): void => {
  stepWatch = null
}

const announceSteps = (stage: 1 | 2 | 3, day: readonly DayStep[]): void => {
  const now: StepWatch = { stage, done: day.map((d) => d.done) }
  const lines = stepAnnouncements(stepWatch, now)
  stepWatch = now
  for (const line of lines) useClueRevealStore.getState().revealPlain(line)
}

const sameObjective = (a: Objective | null, b: Objective): boolean =>
  a !== null &&
  a.rule === b.rule &&
  a.main === b.main &&
  a.second === b.second &&
  a.marker === b.marker &&
  a.areaM === b.areaM &&
  a.why === b.why &&
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
  watchStageSteps(input.story !== false)
  const selected = selectObjective(input)
  // Once the chapel stair is open it is the way into the catacombs, not the corridor gate.
  const via = redirectViaStair(selected.position, input.playerPos, input.progress.stairRevealed)
  const next = withDigTutorialMarker(
    via && via !== selected.position ? { ...selected, position: via } : selected,
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
    near: useGuidanceStore.getState().hintNear,
  })
}

/** Near/far state for the current tutorial step: stays near with no place to measure against. */
const nextHintNear = (was: boolean, x: number, z: number): boolean => {
  const place = currentTutorialPlace(useGuidanceStore.getState().tutorialDone)
  const target = place ? hintPlacePosition(place) : undefined
  if (!target) return true
  return hintNear(was, { x, z }, { x: target[0], z: target[2] })
}

/** Rule 12 (spec 09, F1): only the starting shovel counts as "no weapon yet". */
const hasRealWeapon = (): boolean =>
  useInventoryStore
    .getState()
    .inventory.slots.some((s) => ITEM_MAP[s.item]?.kind === 'weapon' && s.item !== 'rusty-shovel')

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
  patch.hintNear = nextHintNear(s.hintNear, x, z)
  useGuidanceStore.setState(patch)

  if (isWalkComplete(walk)) completeAction('walk')
  // Step 5 asks for a weapon. Finding one (the axe in the shed) does the job as well as crafting
  // one, so the workbench hint must not hang on under later objectives.
  if (hasRealWeapon()) completeAction('craft')
  tickHunch(step)
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
    subscribeToType('caseTabOpened', () => completeAction('openCaseTab')),
    installControlHintWatchers(),
    useMysteryStore.subscribe((state, prev) => {
      if (state.mystery !== prev.mystery && state.mystery.pages.has(1)) {
        completeAction('readPage')
        refreshGuidance()
      }
    }),
  ]
  return () => offs.forEach((off) => off())
}
