import { beforeEach, describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { countItem } from '../systems/inventory'
import type { Inventory } from '../types'
import { initialLive, useCombatStore } from './combatStore'
import { readPreciseTimers, resetCombatTickRuntime, tickCombat } from './combatTick'
import { useEffectStore } from './effectStore'
import { useGameStore } from './gameStore'
import { useInventoryStore } from './inventoryStore'
import { usePlayerStore } from './playerStore'
import { useDoorStore } from './doorStore'
import { useFeedbackStore } from './feedbackStore'
import { CHAPEL_DOORS } from '../../data/cemeteryLayout'
import { subscribeToType } from '../events'
import { CRANE_SPAWN } from '../../data/cemeteryLayout'
import { initialBoss } from '../systems/bossDirector'
import { createEnemy } from '../systems/enemyAI'
import { useBossStore } from './bossStore'
import { craneSpawnPoint } from './combatTick'
import { useEndingStore } from './endingStore'
import { useEnemyStore } from './enemyStore'
import { useMysteryStore } from './mysteryStore'
import { takePlayerPush } from './playerPush'
import { useProjectileStore } from './projectileStore'

const resetPlayerPushForTest = (): void => {
  takePlayerPush()
}

const input = { interactHeld: false, moving: false, playerPos: [0, 0, 0] as const }

const inv = (hotbar0: 'revolver' | 'bandage' | 'rusty-shovel', cartridges = 6): Inventory => ({
  slots: [
    { item: hotbar0, qty: 1 },
    ...(cartridges > 0 ? [{ item: 'revolver-cartridge' as const, qty: cartridges }] : []),
  ],
  keyItems: [],
  relics: [],
  hotbar: [hotbar0, null, null, null],
})

beforeEach(() => {
  resetCombatTickRuntime()
  useGameStore.setState({ paused: false, taken: false })
  useCombatStore.setState({
    firearms: {},
    durability: {},
    upgrades: [],
    takenPickups: [],
    live: initialLive(),
  })
  useEffectStore.setState({ effects: [] })
  useInventoryStore.setState({ inventory: inv('revolver'), equippedSlot: 0 })
})

const startReload = (leftS: number) => {
  tickCombat(1 / 60, input) // reconcile creates the magazine entry and holds the revolver
  useCombatStore.getState().setMagazine('revolver', 2)
  useCombatStore.getState().patchLive({ reload: { weapon: 'revolver', leftS, totalS: leftS } })
}

describe('tickCombat', () => {
  it('completes a reload and moves the rounds out of the satchel', () => {
    startReload(0.5)
    for (let i = 0; i < 40; i++) tickCombat(1 / 60, input)
    const s = useCombatStore.getState()
    expect(s.live.reload).toBeNull()
    expect(s.firearms.revolver?.magazine).toBe(6)
    expect(countItem(useInventoryStore.getState().inventory, 'revolver-cartridge')).toBe(2)
  })

  it('takes only what the stack has', () => {
    useInventoryStore.setState({ inventory: inv('revolver', 1) })
    startReload(0.1)
    for (let i = 0; i < 10; i++) tickCombat(1 / 60, input)
    expect(useCombatStore.getState().firearms.revolver?.magazine).toBe(3)
    expect(countItem(useInventoryStore.getState().inventory, 'revolver-cartridge')).toBe(0)
  })

  it('stops every timer while the sim is frozen or the player is taken', () => {
    startReload(1)
    useCombatStore.getState().patchLive({ kickLeftS: 1, dodgeCooldownS: 1, tooTiredS: 1 })
    for (const flag of [{ paused: true }, { taken: true }]) {
      useGameStore.setState(flag)
      for (let i = 0; i < 120; i++) tickCombat(1 / 60, input)
      const live = useCombatStore.getState().live
      expect(live.reload?.leftS).toBe(1)
      expect(live.kickLeftS).toBe(1)
      expect(live.dodgeCooldownS).toBe(1)
      expect(live.tooTiredS).toBe(1)
      useGameStore.setState({ paused: false, taken: false })
    }
  })

  it('applies a bandage after its use time and removes one', () => {
    useInventoryStore.setState({ inventory: inv('bandage', 0) })
    usePlayerStore.setState({ health: 50, maxHealth: 100 })
    tickCombat(1 / 60, input)
    useCombatStore.getState().patchLive({ use: { item: 'bandage', duration: 2, elapsed: 0 } })
    for (let i = 0; i < 125; i++) tickCombat(1 / 60, input)
    expect(usePlayerStore.getState().health).toBe(80)
    expect(countItem(useInventoryStore.getState().inventory, 'bandage')).toBe(0)
    expect(useCombatStore.getState().live.use).toBeNull()
  })

  it('one 0.1 s step equals ten 0.01 s steps for the timers', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.2, max: 3, noNaN: true }),
        fc.double({ min: 0.2, max: 3, noNaN: true }),
        (reloadS, kickS) => {
          const run = (steps: number, dt: number) => {
            resetCombatTickRuntime()
            useCombatStore.setState({ firearms: {}, live: initialLive() })
            useEffectStore.setState({ effects: [{ id: 'adrenaline', leftS: kickS }] })
            useInventoryStore.setState({ inventory: inv('revolver') })
            tickCombat(1 / 60, input)
            useCombatStore.getState().setMagazine('revolver', 2)
            useCombatStore.getState().patchLive({
              reload: { weapon: 'revolver', leftS: reloadS, totalS: reloadS },
              kickLeftS: kickS,
              dodgeCooldownS: kickS,
            })
            for (let i = 0; i < steps; i++) tickCombat(dt, input)
            const p = readPreciseTimers()
            return {
              reload: p.reloadLeftS,
              kick: useCombatStore.getState().live.kickLeftS,
              cooldown: useCombatStore.getState().live.dodgeCooldownS,
              effect: p.effects[0]?.leftS,
            }
          }
          const a = run(1, 0.1)
          const b = run(10, 0.01)
          expect(b.reload).toBeCloseTo(a.reload as number, 9)
          expect(b.kick).toBeCloseTo(a.kick, 9)
          expect(b.cooldown).toBeCloseTo(a.cooldown, 9)
          expect(b.effect).toBeCloseTo(a.effect as number, 9)
        },
      ),
      { numRuns: 30 },
    )
  })

  it('writes the reload display only when the tenth changes', () => {
    startReload(2)
    let writes = 0
    const unsub = useCombatStore.subscribe((s, prev) => {
      if (s.live.reload !== prev.live.reload) writes++
    })
    for (let i = 0; i < 60; i++) tickCombat(1 / 60, input)
    unsub()
    expect(writes).toBeLessThanOrEqual(11)
  })
})

describe('tickCombat nailing', () => {
  const door = CHAPEL_DOORS.front.point
  const at = [door[0], 0, door[2] + 1] as const
  const held = { interactHeld: true, moving: false, playerPos: at }
  const stock = (planks: number, nails: number): Inventory => ({
    slots: [
      { item: 'rusty-shovel', qty: 1 },
      { item: 'wood-plank', qty: planks },
      { item: 'iron-nail', qty: nails },
    ],
    keyItems: [],
    relics: [],
    hotbar: ['rusty-shovel', null, null, null],
  })
  const begin = () => {
    useDoorStore.getState().reset()
    useDoorStore.getState().build()
    useDoorStore.getState().setDoors({ front: [60], vestry: [60, 60] })
    useInventoryStore.setState({ inventory: stock(3, 5), equippedSlot: 0 })
    useDoorStore.getState().setNail({ door: 'front', elapsedS: 0 })
  }
  const run = (secs: number, i = held) => {
    for (let n = 0; n < Math.round(secs * 60); n++) tickCombat(1 / 60, i)
  }

  it('completes after 2 s and spends exactly the cost', () => {
    begin()
    const events: string[] = []
    const off = subscribeToType('boardNailed', () => events.push('nailed'))
    run(1.9)
    expect(useDoorStore.getState().doors.front).toHaveLength(1)
    run(0.2)
    off()
    const s = useInventoryStore.getState().inventory
    expect(useDoorStore.getState().doors.front).toEqual([60, 60])
    expect(useDoorStore.getState().nail).toBeNull()
    expect(countItem(s, 'wood-plank')).toBe(2)
    expect(countItem(s, 'iron-nail')).toBe(3)
    expect(events).toEqual(['nailed'])
  })

  it('cancels with no spend when the player moves, releases or is hit', () => {
    for (const cancel of ['move', 'release', 'hit'] as const) {
      begin()
      run(1)
      if (cancel === 'move') run(0.1, { ...held, playerPos: [at[0] + 0.2, 0, at[2]] })
      if (cancel === 'release') run(0.1, { ...held, interactHeld: false })
      if (cancel === 'hit') {
        useDoorStore.getState().setNail(null) // what the playerDamaged watcher does
        run(0.1)
      }
      run(2)
      const s = useInventoryStore.getState().inventory
      expect(useDoorStore.getState().nail).toBeNull()
      expect(useDoorStore.getState().doors.front).toHaveLength(1)
      expect(countItem(s, 'wood-plank')).toBe(3)
      expect(countItem(s, 'iron-nail')).toBe(5)
    }
  })

  it('expires damage numbers by 0.8 s and the hit marker', () => {
    useFeedbackStore.getState().setNumbers([{ id: 1, x: 0, y: 1, z: 0, value: 9, headshot: false, ageS: 0 }])
    useFeedbackStore.getState().setMarker({ ageS: 0, kind: 'hit', headshot: false })
    for (let n = 0; n < 40; n++) tickCombat(1 / 60, input)
    expect(useFeedbackStore.getState().numbers).toHaveLength(1)
    for (let n = 0; n < 10; n++) tickCombat(1 / 60, input)
    expect(useFeedbackStore.getState().numbers).toHaveLength(0)
    expect(useFeedbackStore.getState().marker).toBeNull()
  })
})

describe('tickCombat: boss world effects', () => {
  const STEP = 1 / 60
  const run = (seconds: number, pos: readonly [number, number, number] = [0, 0, 0]) => {
    for (let i = 0; i < Math.round(seconds / STEP); i++) {
      tickCombat(STEP, { interactHeld: false, moving: false, playerPos: pos })
    }
  }
  const riseCrane = (x = 0) =>
    useEnemyStore.getState().setEnemies([createEnemy('c', 'father-crane', { x, z: 0 })])
  const tollPending = () =>
    useBossStore.getState().setBoss({
      ...initialBoss(),
      stage: 'risen',
      phase: 2,
      tollIn: 99,
      congregationIn: 99,
      swingIn: 99,
      attack: { kind: 'toll', leftS: 0.001 },
    })

  beforeEach(() => {
    useBossStore.getState().reset()
    useEndingStore.getState().setRiteStarted(false)
    useEnemyStore.getState().setEnemies([])
    useMysteryStore.getState().reset()
    useProjectileStore.getState().reset()
    usePlayerStore.getState().setHealth(100)
    resetPlayerPushForTest()
  })

  it('picks the stair when the catacomb gate is open, else the floor break', () => {
    expect(craneSpawnPoint(true)).toEqual({ x: CRANE_SPAWN.stair[0], z: CRANE_SPAWN.stair[2] })
    expect(craneSpawnPoint(false)).toEqual({ x: CRANE_SPAWN.floorBreak[0], z: CRANE_SPAWN.floorBreak[2] })
  })

  it('spawns a 1500 HP Father Crane at the chosen point after the telegraph', () => {
    const events: string[] = []
    const off = subscribeToType('bossRisen', () => events.push('risen'))
    useEndingStore.getState().setRiteStarted(true)
    useMysteryStore.setState((s) => ({
      mystery: { ...s.mystery, gates: { ...s.mystery.gates, catacombs: true } },
    }))
    run(11.6)
    off()
    const crane = useEnemyStore.getState().enemies.filter((z) => z.type === 'father-crane')
    expect(crane).toHaveLength(1)
    expect(crane[0].hp).toBe(1500)
    expect(crane[0].pos).toEqual({ x: CRANE_SPAWN.stair[0], z: CRANE_SPAWN.stair[2] })
    expect(events).toEqual(['risen'])
  })

  it('counts the rite clock while the player is not holding Interact', () => {
    useEndingStore.getState().setRiteStarted(true)
    run(2)
    expect(useBossStore.getState().boss.riteClock).toBeGreaterThan(1.9)
  })

  it('The Toll hurts for 20 and queues a 3 m push', () => {
    riseCrane()
    tollPending()
    run(STEP * 2, [2, 0, 0])
    expect(usePlayerStore.getState().health).toBe(80)
    const push = takePlayerPush()
    expect(push?.x).toBeCloseTo(3)
  })

  it('a dodge in its invulnerable window ignores the Toll, damage and push', () => {
    riseCrane()
    tollPending()
    useCombatStore.getState().patchLive({ dodge: { elapsedS: 0, dir: { x: 1, z: 0 } } })
    run(STEP * 2, [2, 0, 0])
    expect(usePlayerStore.getState().health).toBe(100)
    expect(takePlayerPush()).toBeNull()
  })

  it('a dead player stops the boss: no timers, no damage', () => {
    riseCrane()
    tollPending()
    useGameStore.setState({ taken: true })
    const before = useBossStore.getState().boss
    run(1, [2, 0, 0])
    expect(useBossStore.getState().boss).toBe(before)
    expect(usePlayerStore.getState().health).toBe(100)
  })

  it('records the ending flag and emits bossDefeated when the quiet ends', () => {
    let defeated = 0
    const off = subscribeToType('bossDefeated', () => defeated++)
    useBossStore.getState().setBoss({ ...initialBoss(), stage: 'dying', stageClock: 3.99 })
    run(STEP * 2)
    off()
    expect(defeated).toBe(1)
    expect(useMysteryStore.getState().mystery.craneRested).toBe(true)
  })
})
