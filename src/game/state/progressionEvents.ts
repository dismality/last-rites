// Progression watchers: kills, shots, digs, boards and pickups feed score, run stats and Grave Coin
// piles (Req 2.1, 2.5, 2.8, 3.1, 3.2, 3.9, 4.5); the same events advance contracts, and the night,
// dawn and phase events deal contracts, offers, stock and storms (Req 1.2, 1.4, 5.6, 6, 8.2, 10).
// Pure zustand glue: no React, three.js or Howler imports.
import { CAPTION_MAP } from '../../data/captions'
import { CONTRACTS } from '../../data/contracts'
import type { EnemyId } from '../../data/enemies'
import { ITEM_MAP } from '../../data/items'
import { MODES } from '../../data/modes'
import { RECIPES } from '../../data/recipes'
import { STAGE_COUNT, STAGE_MAP, type StageNumber } from '../../data/stages'
import { emit, subscribeToType } from '../events'
import { createRng, deriveSeed, type Rng } from '../rng'
import { evaluateAchievements, type AchievementFacts } from '../systems/achievements'
import { addPile, coinDrop } from '../systems/coins'
import {
  advanceContracts,
  dealContracts,
  finishNight,
  type ContractContext,
  type ContractEvent,
  type ContractResult,
} from '../systems/contracts'
import { offerUpgrades } from '../systems/dawnUpgrades'
import { dealStock } from '../systems/merchant'
import {
  recordBoard,
  recordCoins,
  recordCombo,
  recordDig,
  recordKill,
  recordMeleeHit,
  recordNightSurvived,
  recordShot,
  type RunStats,
} from '../systems/runStats'
import { applyBoss, applyKill, nightScore, type KillResult, type ScoreState } from '../systems/score'
import { rollStorm, stormChance } from '../systems/storm'
import { nightPlan } from '../systems/waves'
import { caseOfStage } from '../../data/cases'
import { sharpEye } from '../systems/caseScore'
import { useCaseStore } from './caseStore'
import { stageOfNight } from './stageStore'
import { useAchievementStore } from './achievementStore'
import { useChapelStore } from './chapelStore'
import { useCoinStore } from './coinStore'
import { useEndingStore } from './endingStore'
import { useEnemyStore } from './enemyStore'
import { useGameStore } from './gameStore'
import { useInventoryStore } from './inventoryStore'
import { useMysteryStore } from './mysteryStore'
import { usePlayerStore } from './playerStore'
import { useProgressionStore } from './progressionStore'
import { useScoreStore } from './scoreStore'
import { simClock } from './simClock'
import { CONTRACT_TOAST_MS, useToastStore } from './toastStore'
import { useWorldStore } from './worldStore'

/** Day storms use their own index range so a day and a night never share a roll. */
const DAY_ROLL_BASE = 1_000_000
/** The last 'nightCleared' score parts, kept until the dawn card is built from them. */
let clearedNight: { night: number; clear: number; noDamage: number } | null = null

// One coin stream per run seed and night. A fresh rng per kill would repeat the same roll, so the
// stream is kept between kills and rebuilt when the seed or night changes (or on nightStarted, so
// Retry Night replays the same drops).
let coinRng: { key: string; rng: Rng } | null = null

function coinStream(seed: number, night: number): Rng {
  const key = `${seed}:${night}`
  if (coinRng === null || coinRng.key !== key) {
    coinRng = { key, rng: createRng(deriveSeed(seed, 'coins', night)) }
  }
  return coinRng.rng
}

/** Forget the coin stream so the next drop starts it from the seed again. */
export function resetCoinStream(): void {
  coinRng = null
}

/** New Game: forgets the coin stream and the previous run's night-clear score parts. */
export function resetProgressionEventsRuntime(): void {
  coinRng = null
  clearedNight = null
}

/** Events only count while playing and alive; menus and pause do not block them here. */
export function progressionAccepts(): boolean {
  const g = useGameStore.getState()
  return g.screen === 'game' && !g.taken
}

/** The score store's slice of the pure ScoreState, with the run totals from progressionStore. */
function readScoreState(): ScoreState {
  const sc = useScoreStore.getState()
  const pr = useProgressionStore.getState()
  return {
    score: pr.score,
    bossScored: pr.bossScored,
    combo: sc.combo,
    lastKillAt: sc.lastKillAt,
    seen: sc.seen,
    nightKillPoints: sc.nightKillPoints,
  }
}

function writeScoreState(s: ScoreState): void {
  useScoreStore.getState().patch({
    combo: s.combo,
    lastKillAt: s.lastKillAt,
    seen: [...s.seen],
    nightKillPoints: s.nightKillPoints,
  })
  useProgressionStore.getState().patch({ score: s.score, bossScored: s.bossScored })
}

function updateStats(fn: (s: RunStats) => RunStats): void {
  const pr = useProgressionStore.getState()
  pr.patch({ stats: fn(pr.stats) })
}

const scoreMult = (): number => MODES[useProgressionStore.getState().mode].scoreMult

/** Banks coins straight into the balance, e.g. a pile pushed out by the pile cap. */
function bankCoins(amount: number): void {
  if (amount <= 0) return
  useProgressionStore.getState().addCoins(amount)
  updateStats((s) => recordCoins(s, amount, 0))
}

/** Drops the kill's coins as a pile at the zombie, or at the player's feet if it is gone. */
function dropCoins(uid: string, enemy: EnemyId, elite: boolean): void {
  if (enemy === 'father-crane') return
  const pr = useProgressionStore.getState()
  const night = useWorldStore.getState().nightNumber
  const amount = coinDrop(
    coinStream(pr.seed, night),
    enemy,
    elite,
    grimRank(),
  )
  if (amount <= 0) return
  const zombie = useEnemyStore.getState().enemies.find((e) => e.uid === uid)
  const [px, , pz] = usePlayerStore.getState().position
  const x = zombie ? zombie.pos.x : px
  const z = zombie ? zombie.pos.z : pz
  const coins = useCoinStore.getState()
  const result = addPile(coins.piles, x, z, amount, coins.nextId)
  coins.setPiles(result.piles, coins.nextId + 1)
  bankCoins(result.overflow)
}

function grimRank(): number {
  return useProgressionStore.getState().ranks['grim-harvest'] ?? 0
}

function afterCounted(r: KillResult, headshot: boolean): void {
  writeScoreState(r.state)
  updateStats((s) => recordCombo(s, r.state.combo))
  const sc = useScoreStore.getState()
  sc.patch({
    nightKills: sc.nightKills + 1,
    nightHeadshotKills: sc.nightHeadshotKills + (headshot ? 1 : 0),
  })
}

const contractName = (id: string): string => CONTRACTS.find((c) => c.id === id)?.name ?? id

/** Writes the new list, then pays each completion once: coins, stats, toast and caption. */
function settleContracts(r: ContractResult): void {
  useProgressionStore.getState().setContractList(r.list)
  for (const done of r.completed) {
    bankCoins(done.reward)
    const name = contractName(done.id)
    useToastStore.getState().push(`Contract done: ${name}, +${done.reward} coins`, CONTRACT_TOAST_MS)
    const cap = CAPTION_MAP['contract-done']
    emit({ type: 'subtitleShown', text: cap.text.replace('NAME', name), duration: cap.minSeconds })
  }
}

function advance(e: ContractEvent): void {
  settleContracts(advanceContracts(useProgressionStore.getState().contracts, e))
}

function ownsWeapons(): ContractContext['owns'] {
  const slots = useInventoryStore.getState().inventory.slots
  return {
    revolver: slots.some((s) => s.item === 'revolver'),
    shotgun: slots.some((s) => s.item === 'shotgun'),
  }
}

function achievementFacts(clearHp: number | null): AchievementFacts {
  const pr = useProgressionStore.getState()
  const world = useWorldStore.getState()
  const my = useMysteryStore.getState().mystery
  const inv = useInventoryStore.getState().inventory
  const endless = pr.mode === 'endless' && (world.phase === 'night' || world.phase === 'dawn')
  return {
    nightsSurvived: pr.stats.nightsSurvived,
    digs: pr.stats.digs,
    nightHeadshotKills: useScoreStore.getState().nightHeadshotKills,
    clearHp,
    bestCombo: pr.stats.bestCombo,
    boardsNailed: pr.stats.boardsNailed,
    pagesRead: my.pages.size,
    relics: Math.max(my.relics.size, inv.relics.length),
    craneRested: my.craneRested === true || pr.bossScored,
    ending: useEndingStore.getState().ending,
    endlessNight: endless ? world.nightNumber : 0,
    coinsSpent: pr.stats.coinsSpent,
  }
}

/** Unlocks whatever is newly met. The store ignores ids it already has, so a toast shows once. */
function checkAchievements(): void {
  if (!progressionAccepts()) return
  const ach = useAchievementStore.getState()
  const fresh = evaluateAchievements(ach.unlocked, achievementFacts(useScoreStore.getState().clearHp))
  if (fresh.length > 0) ach.unlock(fresh)
}

/** Ends any storm; the tick reads this flag as the source of truth. */
function endStormFlag(): void {
  const pr = useProgressionStore.getState()
  if (pr.storm.active) pr.patch({ storm: { active: false } })
}

function rollStormFlag(index: number, kind: 'day' | 'night', night: number): void {
  const pr = useProgressionStore.getState()
  const rng = createRng(deriveSeed(pr.seed, 'storm-roll', index))
  pr.patch({ storm: { active: rollStorm(rng, stormChance(kind, night)) } })
}

function recipeNamed(night: number): string | null {
  const r = RECIPES.find((x) => x.unlock.type === 'night' && x.unlock.night === night)
  return r ? (ITEM_MAP[r.output.item]?.name ?? null) : null
}

/** Story dawn card: the recipes the stage that just ended unlocks (spec 10), or null for none. */
function stageRecipesNamed(night: number): string | null {
  const ids = STAGE_MAP[Math.min(Math.max(Math.floor(night), 1), STAGE_COUNT) as StageNumber].dawnUnlocks
  const names = ids
    .map((id) => RECIPES.find((r) => r.id === id))
    .map((r) => (r ? ITEM_MAP[r.output.item]?.name : undefined))
    .filter((n): n is string => typeof n === 'string')
  return names.length > 0 ? names.join(', ') : null
}

function sharpEyeFor(night: number): number {
  const p = useCaseStore.getState().cases[caseOfStage(stageOfNight(night)).id]
  return sharpEye({ hintsUsed: p.hints.revealed, wrongAnswers: p.wrongAnswers })
}

function onNightCleared(night: number): void {
  const pr = useProgressionStore.getState()
  const sc = useScoreStore.getState()
  if (clearedNight?.night === night) return
  const ns = nightScore(readScoreState(), night, sc.nightDamage, scoreMult())
  // Sharp Eye (+300) for a story case solved with no hint and no wrong answer; it rides with the
  // clear bonus so the dawn card total includes it. Doubt's -50 was already taken when it was earned.
  const sharp = MODES[pr.mode].story ? sharpEyeFor(night) : 0
  const clear = ns.clear + Math.round(sharp * scoreMult())
  clearedNight = { night, clear, noDamage: ns.noDamage }
  pr.patch({ score: pr.score + clear + ns.noDamage })
  settleContracts(finishNight(pr.contracts, sc.nightDamage))
  // The facts see the HP the night was cleared with, then the flag is dropped again.
  sc.patch({ clearHp: usePlayerStore.getState().health })
  checkAchievements()
  useScoreStore.getState().patch({ clearHp: null })
}

function onDawn(night: number): void {
  const pr = useProgressionStore.getState()
  const sc = useScoreStore.getState()
  updateStats((s) => recordNightSurvived(s, night))
  settleContracts(finishNight(pr.contracts, sc.nightDamage))
  const wailersNextNight = nightPlan(pr.mode, night + 1).reduce((n, w) => n + w.wailer, 0)
  const dealt = dealContracts(createRng(deriveSeed(pr.seed, 'contracts', night)), {
    owns: ownsWeapons(),
    barricadeBuilt: useChapelStore.getState().isBarricadeBuilt(),
    wailersNextNight,
  })
  const parts = clearedNight?.night === night ? clearedNight : { clear: 0, noDamage: 0 }
  const pages = useMysteryStore.getState().mystery.pages
  // Chapter n makes page n + 1 readable (page 1 is in the hut from the start).
  const pageWaiting = [1, 2, 3, 4, 5].slice(0, Math.min(5, night + 1)).some((p) => !pages.has(p as 1))
  const offer = offerUpgrades(pr.ranks, createRng(deriveSeed(pr.seed, 'offer', night)))
  pr.patch({
    contracts: dealt,
    dawnSummary: {
      night,
      zombiesBanished: sc.nightKills,
      itemsFound: sc.nightItems,
      recipeUnlocked: MODES[pr.mode].story ? stageRecipesNamed(night) : recipeNamed(night),
      journalPageAvailable: pageWaiting,
      killPoints: sc.nightKillPoints,
      clearBonus: parts.clear,
      noDamageBonus: parts.noDamage,
      nightScore: sc.nightKillPoints + parts.clear + parts.noDamage,
    },
    pendingPick: offer.length > 0 ? offer : null,
  })
}

/** Returns the unsubscribe function. */
export function installProgressionWatchers(): () => void {
  const offs: Array<() => void> = []

  offs.push(
    subscribeToType('nightStarted', (e) => {
      resetCoinStream()
      if (!progressionAccepts()) return
      useScoreStore.getState().resetNight()
      clearedNight = null
      rollStormFlag(e.nightNumber, 'night', e.nightNumber)
      checkAchievements()
    }),

    subscribeToType('phaseChanged', (e) => {
      if (!progressionAccepts()) return
      // Any change ends the storm first; only a new day or night may roll another.
      endStormFlag()
      if (e.phase === 'day') {
        const pr = useProgressionStore.getState()
        const night = useWorldStore.getState().nightNumber
        rollStormFlag(DAY_ROLL_BASE + night, 'day', night)
        pr.patch({ stock: dealStock(createRng(deriveSeed(pr.seed, 'stock', night)), ownsWeapons()) })
      }
      checkAchievements()
    }),

    subscribeToType('nightCleared', (e) => {
      if (progressionAccepts()) onNightCleared(e.nightNumber)
    }),

    subscribeToType('dawnStarted', (e) => {
      if (!progressionAccepts()) return
      onDawn(e.nightNumber)
      checkAchievements()
    }),

    subscribeToType('playerDamaged', (e) => {
      if (!progressionAccepts() || !(e.amount > 0)) return
      const sc = useScoreStore.getState()
      sc.patch({ nightDamage: sc.nightDamage + e.amount })
    }),

    subscribeToType('enemyKilled', (e) => {
      if (!progressionAccepts()) return
      const r = applyKill(
        readScoreState(),
        { uid: e.uid, enemy: e.enemy, elite: e.elite, headshot: e.headshot },
        simClock.now,
        scoreMult(),
      )
      // Repeated uids, unknown ids and Father Crane (scored by bossDefeated) change nothing.
      if (!r.counted) return
      afterCounted(r, e.headshot)
      updateStats((s) => recordKill(s, e.enemy))
      dropCoins(e.uid, e.enemy, e.elite)
      advance({ type: 'kill', enemy: e.enemy, source: e.source, headshot: e.headshot })
      checkAchievements()
    }),

    subscribeToType('meleeHit', () => {
      if (progressionAccepts()) updateStats(recordMeleeHit)
    }),

    subscribeToType('firearmFired', (e) => {
      if (progressionAccepts()) updateStats((s) => recordShot(s, e.hit))
    }),

    subscribeToType('boardNailed', () => {
      if (!progressionAccepts()) return
      updateStats(recordBoard)
      advance({ type: 'board' })
    }),

    subscribeToType('digCompleted', () => {
      if (!progressionAccepts()) return
      updateStats(recordDig)
      advance({ type: 'dig' })
    }),

    subscribeToType('itemCollected', (e) => {
      if (!progressionAccepts()) return
      const sc = useScoreStore.getState()
      sc.patch({ nightItems: sc.nightItems + 1 })
      if (ITEM_MAP[e.itemId]?.kind === 'material') advance({ type: 'material' })
    }),

    subscribeToType('bossDefeated', () => {
      if (!progressionAccepts()) return
      const r = applyBoss(readScoreState(), simClock.now, scoreMult())
      if (!r.counted) return
      afterCounted(r, false)
      updateStats((s) => recordKill(s, 'father-crane'))
      checkAchievements()
    }),

    // Pages, relics, Crane and spent coins can meet a goal with no event of their own; stats
    // changes also cover digs, boards and combos.
    useMysteryStore.subscribe((s, prev) => {
      if (s.mystery !== prev.mystery) checkAchievements()
    }),
    useInventoryStore.subscribe((s, prev) => {
      if (s.inventory !== prev.inventory) checkAchievements()
    }),
    useProgressionStore.subscribe((s, prev) => {
      if (s.stats !== prev.stats) checkAchievements()
    }),
  )

  return () => offs.forEach((off) => off())
}
