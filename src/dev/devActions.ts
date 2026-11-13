// What the Dev_Panel buttons do. Every action goes through the same stores and actions as real
// play, and returns a short line for the panel's status bar. No React imports.

import { BOSS } from '../data/boss'
import { caseOfStage, type MinigameId } from '../data/cases'
import { useCaseStore } from '../game/state/caseStore'
import { useOverlayStore } from '../game/state/overlayStore'
import { DUSK_DURATION_S } from '../data/balance'
import { REPAIR_STAGES } from '../data/repairs'
import { RECIPES } from '../data/recipes'
import { SATCHEL_SLOTS_MAX } from '../data/items'
import { WEAPON_PICKUPS, type WeaponPickupId } from '../data/weaponPickups'
import { FIXED_SPAWNS } from '../data/zones'
import type { EnemyId } from '../data/enemies'
import { emit } from '../game/events'
import { startEnding } from '../game/state/startEnding'
import { craneSpawnPoint } from '../game/state/combatTick'
import { takeWeaponPickup } from '../game/state/combatActions'
import { useBossStore } from '../game/state/bossStore'
import { useChapelStore } from '../game/state/chapelStore'
import { useCombatStore } from '../game/state/combatStore'
import { useCraftingStore } from '../game/state/craftingStore'
import { useDoorStore } from '../game/state/doorStore'
import { useEndingStore } from '../game/state/endingStore'
import { useEnemyStore } from '../game/state/enemyStore'
import { useGuidanceStore } from '../game/state/guidanceStore'
import { useInventoryStore } from '../game/state/inventoryStore'
import { useLanternStore } from '../game/state/lanternStore'
import { useMysteryStore } from '../game/state/mysteryStore'
import { clearNightState } from '../game/state/nightState'
import { queueTeleport } from '../game/state/playerTeleport'
import { usePlayerStore } from '../game/state/playerStore'
import { deriveTickInput } from '../game/state/progressionTick'
import { useProgressionStore } from '../game/state/progressionStore'
import { useSpawnStore } from '../game/state/spawnStore'
import { useWaveStore } from '../game/state/waveStore'
import { useWorldStore } from '../game/state/worldStore'
import { createEnemy, type AIEnemy } from '../game/systems/enemyAI'
import { applyDamage } from '../game/systems/combat'
import { killReports } from '../game/systems/killReports'
import { addItem } from '../game/systems/inventory'
import { initialBoss } from '../game/systems/bossDirector'
import { RITE_DURATION } from '../game/systems/mystery'
import { spawnMultipliers } from '../game/systems/modes'
import { clearedRoute } from '../game/systems/waveDirection'
import { expandWave, nightPlan } from '../game/systems/waves'
import { stageWaveComposition } from '../game/systems/stageWaves'
import { stageOfNight, useStageStore } from '../game/state/stageStore'
import { MODES } from '../data/modes'
import type { EndingId, ItemId, KeyItemId, MaterialId, PageNumber, RelicId } from '../game/types'
import { scareRuntime } from '../scene/scares/scareRuntime'
import type { ScareEventId } from '../data/scares'
import { STAGES, type StageNumber } from '../data/stages'
import {
  KEY_ITEM_IDS,
  MATERIAL_IDS,
  PAGE_NUMBERS,
  RELIC_IDS,
  STAGE_START_KEY_ITEMS,
  STAGE_START_PAGES,
} from './devData'

/** Just short of a boundary so the real tick performs the phase change and emits its events. */
const BOUNDARY_EPSILON_S = 0.05
const GROUND_Y = 0.05
/** Objective teleports land this far short of the target, so the player is not inside a shelf. */
const OBJECTIVE_STANDOFF_M = 1.5
const WAVE_RING_M = 14
const EACH_RING_M = 8

// ---------------------------------------------------------------------------
// Teleports
// ---------------------------------------------------------------------------

/** Moves the Rapier body at the next frame, exactly as Retry Night and Continue do. */
export function teleportTo(x: number, z: number, yaw = 0): string {
  const p = usePlayerStore.getState()
  p.setPosition([x, GROUND_Y, z])
  p.setYaw(yaw)
  p.setPitch(0)
  queueTeleport({ position: [x, GROUND_Y, z], yaw, pitch: 0 })
  return `Teleported to ${x.toFixed(1)}, ${z.toFixed(1)}`
}

export function teleportToObjective(): string {
  const o = useGuidanceStore.getState().objective
  if (!o?.position) return 'The current objective has no place'
  const [tx, , tz] = o.position
  // Stand short of the target, on the side the player (the hut) comes from.
  const len = Math.hypot(tx, tz)
  const k = len > OBJECTIVE_STANDOFF_M ? (len - OBJECTIVE_STANDOFF_M) / len : 0
  const x = tx * k
  const z = tz * k
  // Face the target: yaw 0 looks toward -Z, positive yaw turns toward -X.
  const yaw = Math.atan2(-(tx - x), -(tz - z))
  teleportTo(x, z, yaw)
  return `Teleported to objective: ${o.main}`
}

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

export type TimeTarget = 'dawn' | 'midday' | 'dusk' | 'night'

function dayLengthS(): number {
  return deriveTickInput().dayLengthS
}

/** Leaving a night behind must not leave its zombies and waves running. */
function resetFight(): void {
  clearNightState()
  useWorldStore.getState().setWavesCleared(false)
}

export function setTime(target: TimeTarget): string {
  const w = useWorldStore.getState()
  switch (target) {
    case 'midday':
      resetFight()
      w.applyWorldState({ phase: 'day', phaseTime: dayLengthS() / 2 })
      emit({ type: 'phaseChanged', phase: 'day' })
      break
    case 'dusk':
      resetFight()
      w.applyWorldState({ phase: 'day', phaseTime: dayLengthS() - BOUNDARY_EPSILON_S })
      break
    case 'night':
      resetFight()
      w.applyWorldState({ phase: 'dusk', phaseTime: DUSK_DURATION_S - BOUNDARY_EPSILON_S })
      break
    case 'dawn':
      // A cleared night ends on the next tick, which emits dawnStarted for the summary.
      w.applyWorldState({ phase: 'night', phaseTime: 0, wavesCleared: true })
      useStageStore.getState().solveCase(0)
      break
  }
  return `Time: ${target}`
}

/** Starts night `n` at the next tick (a stage 1 to 3 in a story run). */
export function skipToNight(n: number): string {
  resetFight()
  const w = useWorldStore.getState()
  // Story nights are the three stages; Endless keeps counting.
  const night = MODES[useProgressionStore.getState().mode].story ? stageOfNight(n) : n
  w.setNightNumber(night)
  w.applyWorldState({ phase: 'dusk', phaseTime: DUSK_DURATION_S - BOUNDARY_EPSILON_S })
  return `Skipping to night ${night}`
}

// ---------------------------------------------------------------------------
// Stages (spec 10)
// ---------------------------------------------------------------------------

/**
 * Starts stage `n` (1..3) at the beginning of its day, holding what a player would by then:
 * the key items, pages and recipes of the earlier stages. Uses the real stores only.
 */
export function skipToStage(n: StageNumber): string {
  resetFight()
  const w = useWorldStore.getState()
  w.setNightNumber(n)
  useStageStore.getState().startStage(n)
  w.applyWorldState({ phase: 'day', phaseTime: 0, wavesCleared: false })
  emit({ type: 'phaseChanged', phase: 'day' })
  STAGE_START_KEY_ITEMS[n].forEach(giveKeyItem)
  STAGE_START_PAGES[n].forEach(givePage)
  const recipes = STAGES.filter((s) => s.stage < n).flatMap((s) => s.dawnUnlocks)
  useCraftingStore.setState((s) => ({ unlockedRecipes: [...new Set([...s.unlockedRecipes, ...recipes])] }))
  return `Skipped to stage ${n}`
}

/** The real solve action; the stage's night ends on the next tick. Only meaningful at night. */
export function solveCurrentCase(): string {
  const s = useStageStore.getState()
  if (s.caseSolved) return `Case ${s.stage} is already solved`
  s.solveCase()
  return `Solved the case of stage ${s.stage}`
}

// ---------------------------------------------------------------------------
// The case (spec 10 task 2.6)
// ---------------------------------------------------------------------------

const activeCaseDef = () => caseOfStage(useStageStore.getState().stage)

/** Minigames of the active case that are not solved yet, in case order. */
export function unsolvedMinigames(): MinigameId[] {
  const def = activeCaseDef()
  const solved = useCaseStore.getState().cases[def.id].minigames
  return def.minigames.filter((m) => !solved.includes(m))
}

/** Marks every clue of the active case found, through the real store action. */
export function giveAllClues(): string {
  const def = activeCaseDef()
  const added = def.clues.filter((c) => useCaseStore.getState().findClue(c.id)).length
  return added > 0 ? `Found ${added} clues of ${def.title}` : `All clues of ${def.title} are already found`
}

/** Marks one clue found (the e2e uses it to lay out a board without walking the grounds). */
export function giveClue(id: string): string {
  return useCaseStore.getState().findClue(id) ? `Found clue ${id}` : `Clue ${id} is unknown or already found`
}

/**
 * Solves the first unsolved minigame of the active case with a right verdict (the same
 * `submitMinigame` the overlays call, so its clues are found too). Reports "none" when the case
 * has no minigame left to solve.
 */
export function solveCurrentMinigame(): string {
  const next = unsolvedMinigames()[0]
  if (!next) return 'No unsolved minigame in this case'
  useCaseStore.getState().submitMinigame(next, true)
  return `Solved minigame ${next}`
}

/** Draws a string between two found clues, as the board does. */
export function linkClues(a: string, b: string): string {
  const r = useCaseStore.getState().link(a, b)
  return r.added ? `Linked ${a} and ${b}` : `Could not link ${a} and ${b} (not found, or already linked)`
}

/** Opens or closes the altar answer panel (the overlay the player opens at the altar). */
export function setAltarPanel(open: boolean): string {
  useOverlayStore.getState().setAltarPanelOpen(open)
  return `Altar panel ${open ? 'open' : 'closed'}`
}

// ---------------------------------------------------------------------------
// Enemies
// ---------------------------------------------------------------------------

let uid = 0

function addEnemies(made: readonly AIEnemy[]): void {
  const store = useEnemyStore.getState()
  store.setEnemies([...store.enemies, ...made])
}

function ringAround(i: number, n: number, radius: number): { x: number; z: number } {
  const [px, , pz] = usePlayerStore.getState().position
  const a = (i / Math.max(1, n)) * Math.PI * 2
  return { x: px + Math.cos(a) * radius, z: pz + Math.sin(a) * radius }
}

function modeAndNight(): { mode: ReturnType<typeof useProgressionStore.getState>['mode']; night: number } {
  return { mode: useProgressionStore.getState().mode, night: useWorldStore.getState().nightNumber }
}

function make(type: EnemyId, pos: { x: number; z: number }, elite = false): AIEnemy {
  const { mode, night } = modeAndNight()
  const m = spawnMultipliers(mode, night, false)
  return createEnemy(`dev-${uid++}`, type, pos, { ...m, elite })
}

/** Spawns the next wave of the current night around the player (the first one when idle). */
export function spawnWave(): string {
  const { mode, night } = modeAndNight()
  const plan = MODES[mode].story
    ? [stageWaveComposition(stageOfNight(night), useWaveStore.getState().waves.waveIndex)]
    : nightPlan(mode, night)
  if (plan.length === 0) return `No wave plan for night ${night}`
  const index = Math.min(useWaveStore.getState().waves.waveIndex, plan.length - 1)
  const types = expandWave(plan[index])
  addEnemies(types.map((t, i) => make(t, ringAround(i, types.length, WAVE_RING_M))))
  return `Spawned wave ${index + 1} of night ${night} (${types.length})`
}

const EACH_TYPES: readonly { type: EnemyId; elite: boolean }[] = [
  { type: 'shambler', elite: false },
  { type: 'lurker', elite: false },
  { type: 'wailer', elite: false },
  { type: 'bloater', elite: false },
  { type: 'brute', elite: false },
  { type: 'shambler', elite: true },
  { type: 'bloater', elite: true },
  { type: 'brute', elite: true },
]

/** One of each enemy type, then an elite Shambler, Bloater and Brute. */
export function spawnOneOfEach(): string {
  addEnemies(EACH_TYPES.map((e, i) => make(e.type, ringAround(i, EACH_TYPES.length, EACH_RING_M), e.elite)))
  return `Spawned ${EACH_TYPES.length} enemies (elites included)`
}

/** Damages every living enemy through the melee rules and reports the kills as a swing would. */
export function killAll(): string {
  const store = useEnemyStore.getState()
  const before = store.enemies
  const fuel = useLanternStore.getState().fuel
  const after = before.map((e) =>
    e.hp > 0 ? applyDamage(e, 1_000_000, { lanternFuel: fuel, source: 'melee' }) : e,
  )
  store.setEnemies(after)
  const kills = killReports(before, after, 'melee')
  kills.forEach(emit)
  return `Killed ${kills.length}`
}

/** Father Crane on the field at once, phase 1, with the boss director already running. */
export function spawnCrane(): string {
  const enemies = useEnemyStore.getState()
  const at = craneSpawnPoint(useMysteryStore.getState().mystery.gates.catacombs)
  const rest = enemies.enemies.filter((z) => z.type !== 'father-crane')
  enemies.setEnemies([...rest, createEnemy(`dev-crane-${uid++}`, 'father-crane', at)])
  useBossStore.getState().setBoss({
    ...initialBoss(),
    stage: 'risen',
    riteClock: BOSS.riseAfterS,
    nameCardLeftS: BOSS.nameCardS,
    congregationIn: BOSS.congregation.everyS[1],
  })
  emit({ type: 'bossRisen' })
  return 'Father Crane rises'
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

/** Marks the world copy of a key item, relic or page as taken, so it does not lie there twice. */
function markFixedTaken(item: ItemId): void {
  const spawn = FIXED_SPAWNS.find((f) => f.item === item)
  if (!spawn) return
  const s = useSpawnStore.getState()
  if (s.world.collectedFixed.includes(spawn.id)) return
  s.setWorld({ ...s.world, collectedFixed: [...s.world.collectedFixed, spawn.id] })
}

function addToSatchel(id: ItemId, qty: number): number {
  const inv = useInventoryStore.getState()
  const res = addItem(inv.inventory, id, qty, SATCHEL_SLOTS_MAX)
  inv.setInventory(res.inv)
  useCombatStore.getState().reconcile(res.inv)
  return res.added
}

export function giveMaterial(id: MaterialId | ItemId, qty: number): string {
  const added = addToSatchel(id, qty)
  return added > 0 ? `Gave ${added} ${id}` : `Could not add ${id} (stack or satchel full)`
}

export function giveWeapon(id: WeaponPickupId): string {
  const out = takeWeaponPickup(id)
  return out.taken ? `Gave ${id}` : `Could not take ${id} (satchel full?)`
}

export function giveKeyItem(id: KeyItemId): string {
  addToSatchel(id, 1)
  markFixedTaken(id)
  return `Gave ${id}`
}

export function giveRelic(id: RelicId): string {
  addToSatchel(id, 1)
  markFixedTaken(id)
  return `Gave ${id}`
}

export function givePage(page: PageNumber): string {
  const id = `journal-page-${page}` as KeyItemId
  addToSatchel(id, 1)
  markFixedTaken(id)
  useMysteryStore.getState().collectPage(page)
  // Page 3 teaches the Salt Circle, as reading it does.
  useCraftingStore.getState().applyUnlockEvent({ type: 'journalRead', page })
  return `Gave journal page ${page}`
}

export function unlockAllRecipes(): string {
  useCraftingStore.setState({ unlockedRecipes: RECIPES.map((r) => r.id) })
  return `Unlocked ${RECIPES.length} recipes`
}

export function giveEverything(): string {
  KEY_ITEM_IDS.forEach(giveKeyItem)
  RELIC_IDS.forEach(giveRelic)
  PAGE_NUMBERS.forEach(givePage)
  unlockAllRecipes()
  WEAPON_PICKUPS.forEach((p) => takeWeaponPickup(p.id))
  // Satchel slots are limited: ammo and materials fill what is left.
  const held = addToSatchel('revolver-cartridge', 12) + addToSatchel('shotgun-shell', 8)
  const mats = MATERIAL_IDS.reduce((n, m) => n + (addToSatchel(m, 10) > 0 ? 1 : 0), 0)
  return `Gave everything: ${held > 0 ? 'ammo, ' : ''}${mats}/${MATERIAL_IDS.length} materials (satchel limit)`
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

function nextMissingRelic(): RelicId | undefined {
  const have = useInventoryStore.getState().inventory.relics
  return RELIC_IDS.find((r) => !have.includes(r))
}

/** Does what the current objective asks, by the rule that picked it. */
export function completeObjective(): string {
  const o = useGuidanceStore.getState().objective
  if (!o) return 'No objective yet'
  switch (o.rule) {
    case 1: {
      const { mode, night } = modeAndNight()
      const waves = useWaveStore.getState().waves
      useWaveStore.getState().setWaves({ ...waves, phase: 'done', pending: [] })
      killAll()
      // Story: solving the case ends the night; the last stage keeps the old rite flow until task 4.
      if (clearedRoute(mode, night) === 'rite') useEndingStore.getState().setNightFiveCleared(true)
      else if (MODES[mode].story) useStageStore.getState().solveCase()
      else useWorldStore.getState().setWavesCleared(true)
      return 'Night cleared'
    }
    case 2:
      useMysteryStore.setState((s) => ({ mystery: { ...s.mystery, riteProgress: RITE_DURATION } }))
      return 'Rite progress set to full'
    case 3:
      return killAll()
    case 4:
      return setTime('night')
    case 5:
      return givePage(1)
    case 6:
      return giveKeyItem('rusted-crypt-key')
    case 7:
      return giveKeyItem('bone-whistle')
    case 8:
      useMysteryStore.setState((s) => ({
        mystery: { ...s.mystery, gates: { ...s.mystery.gates, catacombs: true } },
      }))
      return 'Catacomb stair revealed'
    case 9:
      return giveKeyItem('iron-ossuary-key')
    case 10: {
      const r = nextMissingRelic()
      return r ? giveRelic(r) : 'All relics held'
    }
    default:
      return setTime('dusk')
  }
}

/** Repairs 0 to 3, without paying; stage 1 also fits the barricades. */
export function setChapelLevel(level: 0 | 1 | 2 | 3): string {
  const chapel = useChapelStore.getState().chapel
  useChapelStore.setState({
    chapel: { ...chapel, completedStages: REPAIR_STAGES.slice(0, level).map((s) => s.effect) },
  })
  const doors = useDoorStore.getState()
  if (level === 0) doors.reset()
  else if (!doors.built) doors.build()
  return `Chapel repairs: ${level}`
}

/** Queues the scare for the stager, which telegraphs and fires it like a rolled one. */
export function triggerScare(id: ScareEventId): string {
  scareRuntime.forced.push(id)
  return `Scare queued: ${id}`
}

export function triggerEnding(id: EndingId): string {
  startEnding(id)
  return `Ending: ${id}`
}
