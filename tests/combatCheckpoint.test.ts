// Checkpoint integration tests for spec 07-combat-and-enemies, task 7.3.
//
// Headless stand-in for a play session: seeded night 3 and night 5 flows that run the real
// zustand stores and the pure systems in node. It proves the pieces fit together (revolver,
// axe, barricade, Bloater chain, elite drop, Father Crane, save, load, Retry Night). It cannot
// check rendering, audio or feel; task 8 covers those in a real browser.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOORS } from '../src/data/barricades'
import { BOSS } from '../src/data/boss'
import { CHAPEL_DOORS } from '../src/data/cemeteryLayout'
import { ELITE } from '../src/data/elites'
import { ENEMY_MAP } from '../src/data/enemies'
import { createRng } from '../src/game/rng'
import { captureCombatSave } from '../src/game/state/combatPersistence'
import { useCombatStore } from '../src/game/state/combatStore'
import { useDoorStore } from '../src/game/state/doorStore'
import { useEnemyStore } from '../src/game/state/enemyStore'
import { loadGame, saveGame } from '../src/game/state/gameSave'
import { useInventoryStore } from '../src/game/state/inventoryStore'
import { useMysteryStore } from '../src/game/state/mysteryStore'
import { retryNight, saveDuskSnapshot } from '../src/game/state/retryNight'
import { useWaveStore } from '../src/game/state/waveStore'
import type { DoorId, Inventory, RelicId } from '../src/game/types'
import { capsuleFor, resolveShot } from '../src/game/systems/ballistics'
import { boardDamageFor, damageDoor, nailBoard, tickNailing } from '../src/game/systems/barricade'
import type { BarricadeState } from '../src/game/systems/barricade'
import { initialBoss, riteCapS, tickBoss, type BossEvent, type BossState } from '../src/game/systems/bossDirector'
import { resolveBurst } from '../src/game/systems/bloater'
import { applyDamage } from '../src/game/systems/combat'
import { placeEliteDrop, rollElite, rollEliteDrop } from '../src/game/systems/elites'
import { createEnemy, tickEnemies, type AIEnemy } from '../src/game/systems/enemyAI'
import { stepRite } from '../src/game/systems/finalRite'
import {
  completeReload,
  pullTrigger,
  startReload,
  tickFirearm,
  type FirearmState,
} from '../src/game/systems/firearm'
import { heavyStatsFor, resolveRelease, startCharge, tickCharge } from '../src/game/systems/heavyAttack'
import { applyKnockdown, knockdownDamageMult } from '../src/game/systems/knockdown'
import { countItem, createInventory } from '../src/game/systems/inventory'
import { collectRelic, createMysteryState } from '../src/game/systems/mystery'
import { firearmStats } from '../src/game/systems/upgrades'
import { startNight, tickWaves } from '../src/game/systems/waves'

const DT = 1 / 60
const ALL_RELICS: RelicId[] = [
  'crane-rosary',
  'sextons-bell-clapper',
  'childs-locket',
  'burial-shroud',
  'reliquary-heart',
]

function fakeStorage(): Storage {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    get length() {
      return m.size
    },
  } as Storage
}

function armedInventory(): Inventory {
  return {
    slots: [
      { item: 'revolver', qty: 1 },
      { item: 'wood-axe', qty: 1 },
      { item: 'revolver-cartridge', qty: 12 },
      { item: 'wood-plank', qty: 3 },
      { item: 'iron-nail', qty: 6 },
    ],
    keyItems: [],
    relics: [],
    hotbar: [null, null, null, null],
  } as Inventory
}

/** Every number a flow produces that a second run with the same seed must repeat. */
interface FlowSummary {
  spawnTypes: string[]
  headshot: { damage: number; headshot: boolean }
  magazineAfterShots: number
  dryOutcome: string
  magazineAfterReload: number
  ammoLeft: number
  brute: { heavy: boolean; knockedDown: boolean; nextHitMult: number; hpAfter: number }
  boards: { nailed: number[]; afterBreak: number[]; brokenAtS: number }
  bloater: { killed: string[]; hp: Record<string, number>; playerNear: number; playerFar: number }
  elite: { isElite: boolean; second: boolean; drop: string; qty: number; owned: number }
  boss: { events: string[]; progressWhileAlive: number; completedAtKill: boolean; ending: string | null } | null
}

/** Types that a night's waves spawn when nothing is ever killed, so every wave comes out. */
function spawnedTypes(night: 3 | 5, seed: number): string[] {
  const rng = createRng(seed)
  let waves = startNight(night)
  const types: string[] = []
  for (let i = 0; i < 60 * 600 && waves.phase !== 'done'; i++) {
    const t = tickWaves(waves, DT, { playerPos: { x: 0, z: 0 }, liveCount: 0, rng })
    waves = t.state
    for (const s of t.spawns) types.push(s.type)
  }
  return [...new Set(types)].sort()
}

function runFlow(night: 3 | 5, seed: number): FlowSummary {
  const rng = createRng(seed)
  // Fresh stores for this run.
  useInventoryStore.getState().setInventory(armedInventory())
  useCombatStore.setState({
    firearms: { revolver: { magazine: 6 } },
    durability: { 'wood-axe': 60 },
    upgrades: [],
    takenPickups: ['revolver', 'wood-axe'],
  })
  useDoorStore.getState().reset()
  useDoorStore.getState().build()
  useMysteryStore.getState().reset()
  useEnemyStore.getState().setEnemies([])

  const spawnTypes = spawnedTypes(night, seed)

  // 1. Revolver: a headshot, an empty magazine, a dry pull, then a reload from the stack.
  const stats = firearmStats('revolver', [])
  const shambler = createEnemy('target', 'shambler', { x: 0, z: -10 })
  const headY = 1.75 - 0.1 // inside the top 0.3 m of the capsule
  const shot = resolveShot(
    {
      weapon: 'revolver',
      origin: { x: 0, y: headY, z: 0 },
      aim: { x: 0, y: 0, z: -1 },
      aiming: true,
      stats,
      blessed: false,
      seed: Math.floor(rng() * 0x7fffffff),
    },
    [capsuleFor(shambler)],
    () => Infinity,
  )
  const hit = shot.hits[0]
  let gun: FirearmState = { magazine: 6, reloadLeftS: null, sinceShotS: 99 }
  for (let i = 0; i < 3; i++) {
    gun = tickFirearm(pullTrigger(gun, stats).state, stats.fireIntervalS)
  }
  useCombatStore.getState().setMagazine('revolver', gun.magazine)
  const magazineAfterShots = useCombatStore.getState().firearms.revolver!.magazine
  while (gun.magazine > 0) gun = tickFirearm(pullTrigger(gun, stats).state, stats.fireIntervalS)
  const dryOutcome = pullTrigger(gun, stats).outcome
  const stack = countItem(useInventoryStore.getState().inventory, 'revolver-cartridge')
  gun = startReload(gun, stats, stack)
  for (let i = 0; i < Math.ceil((stats.reloadS + 0.1) / DT); i++) gun = tickFirearm(gun, DT)
  const reloaded = completeReload(gun, stats, stack)
  useCombatStore.getState().setMagazine('revolver', reloaded.state.magazine)

  // 2. Axe: a full charge knocks a Brute down, and the next blow lands for +25%.
  const axe = heavyStatsFor('wood-axe', [])
  let charge = startCharge(false)
  for (let i = 0; i < Math.ceil(axe.chargeS / DT) + 2; i++) charge = tickCharge(charge, DT, axe.chargeS).charge
  const release = resolveRelease(charge, axe, 100)
  const brute = createEnemy('brute-1', 'brute', { x: 3, z: 0 })
  let b = applyDamage(brute, axe.heavyDamage, { lanternFuel: 100 })
  if (release.kind === 'heavy') b = applyKnockdown(b, axe.knockdownS)
  const nextHitMult = knockdownDamageMult(b)
  useCombatStore.getState().spendDurability('wood-axe')

  // 3. Barricade: nail a board, then a Door_Attacker breaks the door down.
  let bar: BarricadeState = { built: true, doors: useDoorStore.getState().doors }
  const nailed = nailBoard(bar, useInventoryStore.getState().inventory, 'front', DOORS.boardHp)
  expect(nailed.ok).toBe(true)
  bar = nailed.state
  useInventoryStore.getState().setInventory(nailed.inv)
  // Hold Interact for the nail time without moving; the timer finishes exactly once.
  let nail: { door: DoorId; elapsedS: number } | null = { door: 'front', elapsedS: 0 }
  let done = false
  for (let i = 0; i < 200 && !done; i++) {
    const t = tickNailing(nail, DT, { held: true, moved: false, damaged: false, inRange: true })
    nail = t.nail
    done = t.done
  }
  expect(done).toBe(true)
  const nailedBoards = [...bar.doors.front]
  const stand = CHAPEL_DOORS.front.standPoint
  let attacker: AIEnemy = {
    ...createEnemy('door-1', 'shambler', { x: stand[0], z: stand[2] }),
    state: 'chase',
    target: 'front',
    doorAttacker: true,
  }
  let elapsed = 0
  while (bar.doors.front.length > 0 && elapsed < 300) {
    elapsed += DT
    const r = tickEnemies([attacker], DT, {
      playerPos: { x: 10, z: 8 },
      playerFacing: { x: 0, z: -1 },
      lanternFuel: 100,
      doors: { front: { x: stand[0], z: stand[2] }, vestry: { x: 6.5, z: 9.5 } },
    })
    attacker = r.enemies[0]
    for (const ev of r.events) {
      if (ev.type === 'enemyAttack' && ev.target === 'front') {
        bar = damageDoor(bar, 'front', boardDamageFor(ev.damage, ev.enemyType, night === 5)).state
      }
    }
  }
  useDoorStore.getState().setDoors(bar.doors)

  // 4. Bloater chain: the first burst kills the second Bloater, whose burst hurts the third.
  const b1 = { ...createEnemy('bl-1', 'bloater', { x: 20, z: 20 }), hp: 0 }
  const b2 = { ...createEnemy('bl-2', 'bloater', { x: 21, z: 20 }), hp: 20 }
  const z3 = createEnemy('z-3', 'shambler', { x: 22.5, z: 20 })
  const ctx = { lanternFuel: 100 }
  const first = resolveBurst(b1.pos, b1.uid, [b1, b2, z3], { x: 40, z: 40 }, ctx)
  const second = resolveBurst(b2.pos, b2.uid, first.enemies, { x: 40, z: 40 }, ctx)
  const near = resolveBurst(b1.pos, b1.uid, [b1], { x: 21, z: 20 }, ctx)
  const bloater = {
    killed: first.killedUids,
    hp: Object.fromEntries(second.enemies.map((e) => [e.uid, e.hp])),
    playerNear: near.playerDamage,
    playerFar: first.playerDamage,
  }

  // 5. Elite: one per wave, always one drop, never lost.
  const isElite = rollElite(rng, 'shambler', night, false, 1)
  const secondElite = rollElite(rng, 'shambler', night, true, 1)
  const drop = rollEliteDrop(rng)
  const placed = placeEliteDrop(useInventoryStore.getState().inventory, drop, [1, 0, 1], 'drop-1')
  useInventoryStore.getState().setInventory(placed.inv)
  const eliteBase = createEnemy('elite-1', 'shambler', { x: 0, z: 0 }, { elite: isElite })
  expect(eliteBase.hp).toBe(ENEMY_MAP.shambler.hp * ELITE.hpMult)
  const owned =
    countItem(placed.inv, drop.item) + (placed.ground ? placed.ground.qty : 0)

  // 6. Night 5 only: the rite until Father Crane rises and falls, then it finishes.
  let boss: FlowSummary['boss'] = null
  if (night === 5) {
    let mystery = createMysteryState()
    for (const r of ALL_RELICS) mystery = collectRelic(mystery, r)
    let state: BossState = initialBoss()
    const events: string[] = []
    let craneHp: number | null = null
    let progressWhileAlive = 0
    let completed = false
    let completedAtKill = false
    const killAtS = 50
    for (let i = 0; i < Math.round(80 / DT) && !completed; i++) {
      const t = i * DT
      if (craneHp !== null && t >= killAtS) craneHp = 0
      const tick = tickBoss(state, {
        dt: DT,
        riteStarted: true,
        playerDead: false,
        player: { x: 500, z: 500 },
        crane: craneHp === null ? null : { hp: craneHp, maxHp: BOSS_HP(), pos: { x: 10, z: 10 }, inSalt: false },
      })
      state = tick.state
      for (const e of tick.events as BossEvent[]) {
        events.push(e.type === 'phase' ? `phase-${e.phase}` : e.type)
        if (e.type === 'spawn') craneHp = BOSS_HP()
      }
      if (craneHp !== null && craneHp > 0 && t > 30) craneHp = Math.max(1, craneHp - BOSS_HP() / (20 / DT))
      const step = stepRite(mystery, DT, true, 5, riteCapS(state))
      mystery = step.mystery
      if (craneHp !== null && craneHp > 0) progressWhileAlive = Math.max(progressWhileAlive, mystery.riteProgress)
      if (step.completed) {
        completed = true
        completedAtKill = state.stage === 'dead'
      }
    }
    useMysteryStore.setState({ mystery })
    boss = {
      events: [...new Set(events)],
      progressWhileAlive,
      completedAtKill,
      ending: mystery.ending ?? null,
    }
  }

  return {
    spawnTypes,
    headshot: { damage: hit.damage, headshot: hit.headshot },
    magazineAfterShots,
    dryOutcome,
    magazineAfterReload: reloaded.state.magazine,
    ammoLeft: stack - reloaded.ammoUsed,
    brute: {
      heavy: release.kind === 'heavy',
      knockedDown: (b.knockdown ?? 0) > 0,
      nextHitMult,
      hpAfter: b.hp,
    },
    boards: { nailed: nailedBoards, afterBreak: [...bar.doors.front], brokenAtS: Math.round(elapsed) },
    bloater,
    elite: { isElite, second: secondElite, drop: drop.item, qty: drop.qty, owned },
    boss,
  }
}

// Father Crane's HP comes from the enemy table, not a literal here.
const BOSS_HP = (): number => ENEMY_MAP['father-crane'].hp

beforeEach(() => {
  vi.stubGlobal('localStorage', fakeStorage())
  vi.stubGlobal('sessionStorage', fakeStorage())
  useWaveStore.getState().reset()
})
afterEach(() => vi.unstubAllGlobals())

describe('combat checkpoint: night 3', () => {
  it('plays the revolver, axe, door, Bloater and elite beats', () => {
    const s = runFlow(3, 303)
    expect(s.spawnTypes).toContain('bloater')
    expect(s.spawnTypes).not.toContain('brute')
    expect(s.headshot).toEqual({ damage: 68, headshot: true })
    expect(s.magazineAfterShots).toBe(3)
    expect(s.dryOutcome).toBe('dry')
    expect(s.magazineAfterReload).toBe(6)
    expect(s.ammoLeft).toBe(6)
    expect(s.brute.heavy).toBe(true)
    expect(s.brute.knockedDown).toBe(true)
    expect(s.brute.nextHitMult).toBeGreaterThan(1)
    expect(s.boards.nailed).toHaveLength(3)
    expect(s.boards.afterBreak).toEqual([])
    expect(s.bloater.killed).toContain('bl-2')
    expect(s.bloater.playerNear).toBe(25)
    expect(s.bloater.playerFar).toBe(0)
    expect(s.elite.isElite).toBe(true)
    expect(s.elite.second).toBe(false)
    expect(s.elite.owned).toBeGreaterThanOrEqual(s.elite.qty)
    expect(s.boss).toBeNull()
  })
})

describe('combat checkpoint: night 5', () => {
  it('holds the rite at the cap until Father Crane falls, then finishes it', () => {
    const s = runFlow(5, 505)
    expect(s.spawnTypes).toEqual(expect.arrayContaining(['bloater', 'brute']))
    expect(s.boss).not.toBeNull()
    const boss = s.boss!
    expect(boss.events).toEqual(
      expect.arrayContaining(['riseTelegraph', 'spawn', 'phase-2', 'phase-3', 'deathStart', 'quietEnded']),
    )
    expect(boss.progressWhileAlive).toBeLessThanOrEqual(BOSS.riteCapS)
    expect(boss.completedAtKill).toBe(true)
    expect(boss.ending).toBe('rest')
  })
})

describe('combat checkpoint: save, load and retry', () => {
  it('repeats exactly for the same seed', () => {
    const a = runFlow(5, 77)
    const b = runFlow(5, 77)
    expect(b).toEqual(a)
  })

  it('save then load restores the combat state the flow left behind', () => {
    runFlow(3, 11)
    const before = captureCombatSave({
      built: useDoorStore.getState().built,
      front: [...useDoorStore.getState().doors.front],
      vestry: [...useDoorStore.getState().doors.vestry],
    })
    expect(saveGame()).toBe(true)
    useCombatStore.setState({ firearms: {}, durability: {}, upgrades: [], takenPickups: [] })
    useDoorStore.getState().reset()
    expect(loadGame()).toBe(true)
    const after = captureCombatSave({
      built: useDoorStore.getState().built,
      front: [...useDoorStore.getState().doors.front],
      vestry: [...useDoorStore.getState().doors.vestry],
    })
    expect(after).toEqual(before)
  })

  it('Retry Night returns to the dusk state and the replay matches', () => {
    useInventoryStore.getState().setInventory(createInventory())
    const first = runFlow(5, 909)
    // The dusk snapshot is taken after setup, so rebuild what dusk looked like for this seed.
    useInventoryStore.getState().setInventory(armedInventory())
    useCombatStore.setState({ firearms: { revolver: { magazine: 6 } }, durability: { 'wood-axe': 60 } })
    useDoorStore.getState().build()
    useMysteryStore.getState().reset()
    expect(saveDuskSnapshot()).toBe(true)
    const dusk = captureCombatSave({
      built: useDoorStore.getState().built,
      front: [...useDoorStore.getState().doors.front],
      vestry: [...useDoorStore.getState().doors.vestry],
    })
    const replayBase = runFlow(5, 909)
    expect(replayBase).toEqual(first)
    retryNight()
    const restored = captureCombatSave({
      built: useDoorStore.getState().built,
      front: [...useDoorStore.getState().doors.front],
      vestry: [...useDoorStore.getState().doors.vestry],
    })
    expect(restored).toEqual(dusk)
    expect(useMysteryStore.getState().mystery.riteProgress).toBe(0)
    expect(useEnemyStore.getState().enemies).toEqual([])
    // Replaying the same night from that dusk gives the same result.
    expect(runFlow(5, 909)).toEqual(first)
  })
})
