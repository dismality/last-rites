// Store glue for the hut vending machine (spec 11 H6): buyFromVending, the dawn restock, saves
// and New Game.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { VENDING_MACHINE } from '../../data/hutScenery'
import { emit } from '../events'
import { addItem, countItem, createInventory } from '../systems/inventory'
import { freshStock } from '../systems/vending'
import { setCombatSoundListener, type CombatSoundId } from './combatSounds'
import { captureSave } from './gameSave'
import { useInventoryStore } from './inventoryStore'
import { isMenuOpen, isOverlayOpen, isSimFrozen } from './menuState'
import { useOverlayStore } from './overlayStore'
import { usePlayerStore } from './playerStore'
import { startRun } from './progressionActions'
import { useProgressionStore } from './progressionStore'
import { resetRun } from './resetRun'
import {
  buyFromVending,
  closeVending,
  closeVendingIfOut,
  installVendingWatchers,
  openVending,
  resetVendingStock,
} from './vendingActions'
import { useVendingStore } from './vendingStore'

const heard: { id: CombatSoundId; at?: { x: number; z: number } }[] = []

beforeEach(() => {
  startRun('normal')
  heard.length = 0
  setCombatSoundListener((id, at) => heard.push({ id, at }))
})
afterEach(() => setCombatSoundListener(null))

const coins = (n: number) => useProgressionStore.getState().patch({ coins: n })

describe('buyFromVending', () => {
  it('takes the price, one stock and adds the goods, with a coin clink from the machine', () => {
    coins(20)
    expect(buyFromVending('brisk-draught')).toBeNull()
    expect(useProgressionStore.getState().coins).toBe(5)
    expect(useVendingStore.getState().stock.stockLeft['brisk-draught']).toBe(0)
    expect(countItem(useInventoryStore.getState().inventory, 'brisk-draught')).toBe(1)
    expect(useVendingStore.getState().lastPurchase).toMatchObject({ row: 'brisk-draught', handle: 4, seq: 1 })
    expect(heard.map((h) => h.id)).toEqual(['vending-coin'])
    expect(heard[0].at).toMatchObject({ x: VENDING_MACHINE.position[0], z: VENDING_MACHINE.position[2] })
  })

  it('refuses short of coins without touching anything, with the shortfall', () => {
    coins(4)
    const before = useInventoryStore.getState().inventory
    expect(buyFromVending('bandage')).toMatchObject({ reason: 'coins', shortfall: 3 })
    expect(useProgressionStore.getState().coins).toBe(4)
    expect(useInventoryStore.getState().inventory).toBe(before)
    expect(useVendingStore.getState().stock).toEqual(freshStock())
    expect(heard.map((h) => h.id)).toEqual(['vending-refuse'])
  })

  it('refuses a gun row while the gun is not owned', () => {
    coins(100)
    expect(buyFromVending('revolver-cartridge')).not.toBeNull()
    expect(useProgressionStore.getState().coins).toBe(100)
    useInventoryStore.getState().setInventory(addItem(createInventory(), 'revolver', 1).inv)
    expect(buyFromVending('revolver-cartridge')).toBeNull()
    expect(countItem(useInventoryStore.getState().inventory, 'revolver-cartridge')).toBe(6)
  })

  it('refuses a sold-out row and leaves the coins', () => {
    coins(100)
    expect(buyFromVending('kola-tonic')).toBeNull()
    expect(buyFromVending('kola-tonic')).toMatchObject({ reason: 'sold-out', text: 'Sold out' })
    expect(useProgressionStore.getState().coins).toBe(82)
  })
})

describe('the machine through the day', () => {
  it('restocks at dawn', () => {
    const off = installVendingWatchers()
    coins(100)
    buyFromVending('bandage')
    buyFromVending('bandage')
    expect(useVendingStore.getState().stock.stockLeft.bandage).toBe(0)
    emit({ type: 'dawnStarted', nightNumber: 1 })
    expect(useVendingStore.getState().stock).toEqual(freshStock())
    off()
  })

  it('is saved, and New Game refills it', () => {
    coins(100)
    buyFromVending('lamp-oil')
    expect(captureSave().vending?.stockLeft['lamp-oil']).toBe(2)
    resetRun()
    expect(useVendingStore.getState().stock).toEqual(freshStock())
    expect(useVendingStore.getState().lastPurchase).toBeNull()
  })

  it('resetVendingStock refills every row', () => {
    useVendingStore.getState().setStock({ stockLeft: { ...freshStock().stockLeft, bandage: 0, 'lamp-oil': 1 } })
    resetVendingStock()
    expect(useVendingStore.getState().stock).toEqual(freshStock())
  })
})

describe('the panel overlay', () => {
  it('holds the cursor but never freezes the world', () => {
    openVending()
    expect(useOverlayStore.getState().vendingOpen).toBe(true)
    expect(isOverlayOpen()).toBe(true)
    expect(isMenuOpen()).toBe(true)
    expect(isSimFrozen()).toBe(false)
    closeVending()
    expect(isOverlayOpen()).toBe(false)
  })

  it('closes once the keeper walks out of reach', () => {
    const [mx, , mz] = VENDING_MACHINE.position
    usePlayerStore.getState().applyPlayerState({ position: [mx - 1.5, 1.6, mz] })
    openVending()
    expect(closeVendingIfOut()).toBe(false)
    usePlayerStore.getState().applyPlayerState({ position: [mx - 3, 1.6, mz] })
    expect(closeVendingIfOut()).toBe(true)
    expect(useOverlayStore.getState().vendingOpen).toBe(false)
  })
})
