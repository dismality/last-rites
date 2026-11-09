import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearSubscribers, subscribeToType } from '../events'
import { createEnemy } from '../systems/enemyAI'
import type { EnemyId } from '../../data/enemies'
import type { FirearmId, ItemId } from '../types'
import {
  buyUpgrade,
  dodge,
  fireHeld,
  kick,
  releaseHeavy,
  reloadHeld,
  startNail,
  takeWeaponPickup,
  useHeld,
} from './combatActions'
import { useDoorStore } from './doorStore'
import { useToastStore } from './toastStore'
import { createInventory } from '../systems/inventory'
import { useCraftingStore } from './craftingStore'
import type { Inventory } from '../types'
import { usePlayerStore } from './playerStore'
import { resetStaminaRuntime } from './staminaRuntime'
import { startCharge } from '../systems/heavyAttack'
import { initialLive, useCombatStore } from './combatStore'
import { setCombatSoundListener } from './combatSounds'
import { useEffectStore } from './effectStore'
import { useEnemyStore } from './enemyStore'
import { useFeedbackStore } from './feedbackStore'
import { useInventoryStore } from './inventoryStore'
import { useLanternStore } from './lanternStore'

const ORIGIN = { x: 0, y: 1, z: 0 }
const AIM = { x: 0, y: 0, z: 1 }

function setup(weapon: FirearmId, magazine: number, spare = 4): void {
  const ammo = weapon === 'revolver' ? 'revolver-cartridge' : 'shotgun-shell'
  useInventoryStore.setState({
    inventory: {
      slots: [
        { item: weapon, qty: 1 },
        { item: ammo, qty: spare },
      ],
      keyItems: [],
      relics: [],
      hotbar: [weapon, null, null, null],
    },
    equippedSlot: 0,
  })
  useCombatStore.setState({
    firearms: { [weapon]: { magazine } },
    upgrades: [],
    live: { ...initialLive(), sinceShotS: 10 },
  })
  useLanternStore.setState({ fuel: 50 })
  useEffectStore.getState().clear()
  useFeedbackStore.getState().clear()
}

function place(type: EnemyId, z: number, uid = 'z-1'): void {
  const e = createEnemy(uid, type, { x: 0, z })
  useEnemyStore.setState({ enemies: [...useEnemyStore.getState().enemies, e] })
}

const hpOf = (uid: string): number => useEnemyStore.getState().enemies.find((e) => e.uid === uid)!.hp

beforeEach(() => {
  useEnemyStore.setState({ enemies: [] })
})
afterEach(() => {
  clearSubscribers()
  setCombatSoundListener(null)
})

describe('fireHeld', () => {
  it('spends one round and raises one noise event per pull, even for the shotgun', () => {
    setup('shotgun', 2)
    place('shambler', 4)
    const r = fireHeld({ origin: ORIGIN, aim: AIM, aiming: false, seed: 1 })
    expect(r.outcome).toBe('fired')
    expect(useCombatStore.getState().firearms.shotgun?.magazine).toBe(1)
    expect(r.noise).toEqual({ pos: { x: 0, z: 0 }, radiusM: 40 })
    expect(r.hits.length).toBe(1)
    expect(r.hits[0].pellets).toBeGreaterThan(1)
  })

  it('dry pulls raise no noise and start no reload', () => {
    setup('revolver', 0)
    place('shambler', 4)
    const r = fireHeld({ origin: ORIGIN, aim: AIM, aiming: false })
    expect(r.outcome).toBe('dry')
    expect(r.noise).toBeNull()
    expect(useCombatStore.getState().live.reload).toBeNull()
    expect(useEnemyStore.getState().enemies[0].investigate).toBeNull()
  })

  it('emits enemyKilled once per kill', () => {
    setup('revolver', 6)
    place('shambler', 3)
    useEffectStore.getState().setEffects([{ id: 'blessed-rounds', leftS: 30 }])
    const kills: string[] = []
    subscribeToType('enemyKilled', (e) => kills.push(e.uid))
    const r = fireHeld({ origin: ORIGIN, aim: AIM, aiming: true, seed: 2 })
    expect(r.kills).toEqual(['z-1'])
    expect(kills).toEqual(['z-1'])
    expect(hpOf('z-1')).toBe(0)
    // A second pull at the corpse must not kill it again.
    useCombatStore.getState().patchLive({ sinceShotS: 10 })
    fireHeld({ origin: ORIGIN, aim: AIM, aiming: true, seed: 3 })
    expect(kills).toEqual(['z-1'])
  })

  it('knocks a Brute down at 3 m or closer, not further', () => {
    setup('shotgun', 2)
    place('brute', 2, 'near')
    fireHeld({ origin: ORIGIN, aim: AIM, aiming: true, seed: 4 })
    expect(useEnemyStore.getState().enemies[0].knockdown).toBeGreaterThan(0)

    setup('shotgun', 2)
    useEnemyStore.setState({ enemies: [] })
    place('brute', 6, 'far')
    fireHeld({ origin: ORIGIN, aim: AIM, aiming: true, seed: 4 })
    expect(useEnemyStore.getState().enemies[0].knockdown).toBe(0)
    expect(hpOf('far')).toBeLessThan(300)
  })

  it('Blessed Rounds doubles firearm damage', () => {
    setup('revolver', 6)
    place('brute', 5)
    fireHeld({ origin: ORIGIN, aim: AIM, aiming: true, seed: 5 })
    const plain = 300 - hpOf('z-1')

    setup('revolver', 6)
    useEnemyStore.setState({ enemies: [] })
    place('brute', 5)
    useEffectStore.getState().setEffects([{ id: 'blessed-rounds', leftS: 30 }])
    fireHeld({ origin: ORIGIN, aim: AIM, aiming: true, seed: 5 })
    expect(300 - hpOf('z-1')).toBe(plain * 2)
  })

  it('returns a recoil kick and nothing without a firearm', () => {
    setup('revolver', 6)
    expect(fireHeld({ origin: ORIGIN, aim: AIM, aiming: false }).recoilKickDeg).toBeGreaterThan(0)
    useInventoryStore.setState({ equippedSlot: null })
    expect(fireHeld({ origin: ORIGIN, aim: AIM, aiming: false }).outcome).toBe('no-firearm')
  })
})

describe('reloadHeld', () => {
  it('starts a reload only when rounds are missing and ammo is spare', () => {
    setup('revolver', 6)
    expect(reloadHeld()).toBe(false)
    setup('revolver', 2)
    expect(reloadHeld()).toBe(true)
    expect(useCombatStore.getState().live.reload?.weapon).toBe('revolver')
    expect(reloadHeld()).toBe(false)
    setup('revolver', 2, 0)
    expect(reloadHeld()).toBe(false)
  })
})

function holdItem(item: ItemId, qty = 1): void {
  useInventoryStore.setState({
    inventory: { slots: [{ item, qty }], keyItems: [], relics: [], hotbar: [item, null, null, null] },
    equippedSlot: 0,
  })
  useCombatStore.setState({ live: { ...initialLive(), heldId: item } })
  useEffectStore.getState().clear()
}

function player(stamina: number): void {
  resetStaminaRuntime()
  // yaw 0 looks down -Z, so a zombie at z = -1 is in front.
  usePlayerStore.setState({ position: [0, 0, 0], yaw: 0, stamina, health: 50, maxHealth: 100 })
}

const stamina = (): number => usePlayerStore.getState().stamina
const live = () => useCombatStore.getState().live

describe('releaseHeavy', () => {
  it('full charge with stamina is heavy and spends the cost', () => {
    holdItem('wood-axe')
    player(100)
    useCombatStore.getState().patchLive({ charge: { heldS: 0.8, auto: false } })
    const r = releaseHeavy('wood-axe')
    expect(r.kind).toBe('heavy')
    expect(r.staminaSpent).toBe(25)
    expect(r.knockdownS).toBe(1.5)
    expect(stamina()).toBe(75)
    expect(live().charge).toBeNull()
  })

  it('full charge without stamina is a free normal swing with the cue', () => {
    holdItem('silver-sabre')
    player(19)
    useCombatStore.getState().patchLive({ charge: { heldS: 0.6, auto: false } })
    const r = releaseHeavy('silver-sabre')
    expect(r).toMatchObject({ kind: 'normal', tooTired: true, knockdownS: 0 })
    expect(stamina()).toBe(19)
    expect(live().tooTiredS).toBe(1)
  })

  it('early release is normal and free; no charge changes nothing', () => {
    holdItem('wood-axe')
    player(100)
    useCombatStore.getState().patchLive({ charge: startCharge(false) })
    expect(releaseHeavy('wood-axe')).toMatchObject({ kind: 'normal', tooTired: false })
    expect(stamina()).toBe(100)
    expect(releaseHeavy('wood-axe').kind).toBe('none')
  })
})

describe('kick', () => {
  it('spends stamina and starts the cooldown even with no target', () => {
    holdItem('rusty-shovel')
    player(100)
    const r = kick()
    expect(r).toEqual({ performed: true, targetUid: null, killed: false })
    expect(stamina()).toBe(85)
    expect(live().kickLeftS).toBe(1.2)
  })

  it('hits the zombie in front and staggers it', () => {
    holdItem('rusty-shovel')
    player(100)
    const e = createEnemy('k-1', 'shambler', { x: 0, z: -1 })
    useEnemyStore.setState({ enemies: [e] })
    const r = kick()
    expect(r.targetUid).toBe('k-1')
    expect(hpOf('k-1')).toBe(55)
  })

  it('a failed press changes nothing', () => {
    holdItem('rusty-shovel')
    player(14)
    expect(kick().performed).toBe(false)
    expect(stamina()).toBe(14)
    expect(live().kickLeftS).toBe(0)
    player(100)
    useCombatStore.getState().patchLive({ kickLeftS: 0.5 })
    expect(kick().performed).toBe(false)
    expect(stamina()).toBe(100)
    expect(live().kickLeftS).toBe(0.5)
  })
})

describe('dodge', () => {
  it('spends 25 stamina, starts the dash and the cooldown', () => {
    holdItem('rusty-shovel')
    player(100)
    expect(dodge({ x: 1, z: 0 })).toBe(true)
    expect(stamina()).toBe(75)
    expect(live().dodge?.dir).toEqual({ x: 1, z: 0 })
    expect(live().dodgeCooldownS).toBe(0.8)
  })

  it('a failed press changes nothing', () => {
    holdItem('rusty-shovel')
    player(24)
    expect(dodge()).toBe(false)
    expect(stamina()).toBe(24)
    expect(live().dodge).toBeNull()
    expect(live().dodgeCooldownS).toBe(0)
  })
})

describe('useHeld', () => {
  it('Blessed Rounds applies at once and consumes one item', () => {
    holdItem('blessed-rounds', 2)
    expect(useHeld()).toEqual({ started: true, instant: true, item: 'blessed-rounds' })
    expect(useEffectStore.getState().effects).toEqual([{ id: 'blessed-rounds', leftS: 30 }])
    expect(useInventoryStore.getState().inventory.slots[0].qty).toBe(1)
  })

  it('Kola Tonic applies Adrenaline at once', () => {
    holdItem('kola-tonic')
    useHeld()
    expect(useEffectStore.getState().effects).toEqual([{ id: 'adrenaline', leftS: 20 }])
    expect(useInventoryStore.getState().inventory.slots).toEqual([])
  })

  it('Bandage and Lantern Refill start a timed use and take nothing yet', () => {
    holdItem('bandage')
    expect(useHeld()).toEqual({ started: true, instant: false, item: 'bandage' })
    expect(live().use?.duration).toBe(2)
    expect(useInventoryStore.getState().inventory.slots[0].qty).toBe(1)
    expect(useHeld().started).toBe(false)
    holdItem('lantern-refill')
    useHeld()
    expect(live().use?.duration).toBe(1)
  })

  it('a non-consumable in hand changes nothing', () => {
    holdItem('rusty-shovel')
    expect(useHeld().started).toBe(false)
    expect(live().use).toBeNull()
    expect(useEffectStore.getState().effects).toEqual([])
  })
})

function stock(slots: Inventory['slots']): Inventory {
  return { ...createInventory(), slots }
}

function filler(n: number): Inventory['slots'] {
  const ids = ['bone', 'cloth', 'candle-wax', 'lamp-oil', 'grave-salt', 'holy-water', 'iron-nail', 'wood-plank'] as const
  return ids.slice(0, n).map((item) => ({ item, qty: 1 }))
}

describe('takeWeaponPickup', () => {
  beforeEach(() => {
    useCombatStore.setState({ takenPickups: [], firearms: {}, upgrades: [], live: initialLive() })
    useToastStore.setState({ queue: [] })
  })

  it('a pickup with too few free slots adds nothing and leaves the pickup', () => {
    // 11 of 12 slots used: the revolver needs two (weapon + cartridges).
    const full = stock([...filler(8), { item: 'bandage', qty: 1 }, { item: 'tallow-candle', qty: 1 }, { item: 'lantern-refill', qty: 1 }])
    useInventoryStore.setState({ inventory: full })
    const r = takeWeaponPickup('revolver')
    expect(r).toEqual({ taken: false, message: 'Satchel full' })
    expect(useInventoryStore.getState().inventory).toBe(full)
    expect(useCombatStore.getState().takenPickups).toEqual([])
    expect(useToastStore.getState().queue.map((t) => t.text)).toEqual(['Satchel full'])
  })

  it('takes the weapon, binds the first empty hotbar slot and toasts', () => {
    useInventoryStore.setState({ inventory: stock([]) })
    const r = takeWeaponPickup('wood-axe')
    expect(r.taken).toBe(true)
    const inv = useInventoryStore.getState().inventory
    expect(inv.slots).toEqual([{ item: 'wood-axe', qty: 1 }])
    expect(inv.hotbar[0]).toBe('wood-axe')
    expect(useCombatStore.getState().takenPickups).toEqual(['wood-axe'])
    expect(useToastStore.getState().queue[0].text).toMatch(/^Took the /)
    expect(takeWeaponPickup('wood-axe').taken).toBe(false)
  })
})

describe('buyUpgrade', () => {
  beforeEach(() => {
    useCombatStore.setState({ upgrades: [] })
    useCraftingStore.setState({ unlockedRecipes: [] })
  })

  it('is atomic: a short purchase changes neither satchel nor upgrades', () => {
    const inv = stock([{ item: 'shotgun', qty: 1 }, { item: 'iron-nail', qty: 2 }])
    useInventoryStore.setState({ inventory: inv })
    const r = buyUpgrade('up-shotgun-choke') // needs 3 iron nails
    expect(r).toEqual({ bought: false, message: 'Need 1 more iron nails' })
    expect(useInventoryStore.getState().inventory).toBe(inv)
    expect(useCombatStore.getState().upgrades).toEqual([])
  })

  it('pays the whole cost and records the upgrade together, once', () => {
    useInventoryStore.setState({ inventory: stock([{ item: 'shotgun', qty: 1 }, { item: 'iron-nail', qty: 4 }]) })
    expect(buyUpgrade('up-shotgun-choke')).toEqual({ bought: true })
    expect(useInventoryStore.getState().inventory.slots).toContainEqual({ item: 'iron-nail', qty: 1 })
    expect(useCombatStore.getState().upgrades).toEqual(['up-shotgun-choke'])
    expect(buyUpgrade('up-shotgun-choke').bought).toBe(false)
  })
})

describe('startNail', () => {
  beforeEach(() => {
    useDoorStore.getState().reset()
  })

  it('refuses before the doors are barred', () => {
    useInventoryStore.setState({ inventory: stock([{ item: 'wood-plank', qty: 1 }, { item: 'iron-nail', qty: 2 }]) })
    expect(startNail('front')).toEqual({ started: false, text: 'The door is not barred yet' })
    expect(useDoorStore.getState().nail).toBeNull()
  })

  it('refuses a full door with the prompt text', () => {
    useDoorStore.getState().build()
    useDoorStore.getState().setDoors({ front: [60, 60, 60], vestry: [60, 60] })
    useInventoryStore.setState({ inventory: stock([{ item: 'wood-plank', qty: 1 }, { item: 'iron-nail', qty: 2 }]) })
    expect(startNail('front')).toEqual({ started: false, text: 'Door is full' })
    expect(useDoorStore.getState().nail).toBeNull()
  })

  it('refuses when short of material and spends nothing', () => {
    useDoorStore.getState().build()
    const inv = stock([{ item: 'wood-plank', qty: 1 }, { item: 'iron-nail', qty: 1 }])
    useInventoryStore.setState({ inventory: inv })
    expect(startNail('vestry')).toEqual({ started: false, text: 'Need 1 iron nail' })
    expect(useDoorStore.getState().nail).toBeNull()
    expect(useInventoryStore.getState().inventory).toBe(inv)
  })

  it('starts the timer when it can, without spending yet', () => {
    useDoorStore.getState().build()
    const inv = stock([{ item: 'wood-plank', qty: 1 }, { item: 'iron-nail', qty: 2 }])
    useInventoryStore.setState({ inventory: inv })
    expect(startNail('vestry')).toEqual({ started: true })
    expect(useDoorStore.getState().nail).toEqual({ door: 'vestry', elapsedS: 0 })
    expect(useInventoryStore.getState().inventory).toBe(inv)
  })
})
