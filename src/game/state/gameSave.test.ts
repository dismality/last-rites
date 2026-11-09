import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SAVE_KEY } from '../systems/saveGame'
import { canContinue, captureSave, loadGame, saveGame } from './gameSave'
import { useCombatStore } from './combatStore'
import { useDoorStore } from './doorStore'
import { useGuidanceStore } from './guidanceStore'
import { useIntroStore } from './introStore'
import { useInventoryStore } from './inventoryStore'
import { useMysteryStore } from './mysteryStore'

function stubStorage(initial: Record<string, string> = {}) {
  const data = new Map<string, string>(Object.entries(initial))
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  })
  return data
}

describe('save and load: tutorial and intro flag', () => {
  beforeEach(() => {
    useGuidanceStore.getState().restore([])
    useIntroStore.getState().setSeen(false)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('restores completed steps and introSeen after a save then load', () => {
    stubStorage()
    useGuidanceStore.getState().setTutorialDone(new Set([1, 2, 3] as const))
    useIntroStore.getState().setSeen(true)
    expect(captureSave().tutorial).toEqual(new Set([1, 2, 3]))
    expect(saveGame()).toBe(true)

    useGuidanceStore.getState().restore([])
    useIntroStore.getState().setSeen(false)
    expect(loadGame()).toBe(true)
    expect([...useGuidanceStore.getState().tutorialDone]).toEqual([1, 2, 3])
    expect(useIntroStore.getState().seen).toBe(true)
  })

  it('loads an old save without the new fields using defaults', () => {
    const data = stubStorage()
    saveGame()
    const file = JSON.parse(data.get(SAVE_KEY)!) as Record<string, unknown>
    delete file.tutorial
    delete file.introSeen
    data.set(SAVE_KEY, JSON.stringify(file))
    useGuidanceStore.getState().setTutorialDone(new Set([4] as const))

    expect(loadGame()).toBe(true)
    expect(useGuidanceStore.getState().tutorialDone.size).toBe(0)
    // Fresh world is day 1, so the intro counts as not seen.
    expect(useIntroStore.getState().seen).toBe(false)
  })

  it('hides Continue for a corrupt save and leaves other storage alone', () => {
    const data = stubStorage({ [SAVE_KEY]: '{not json', 'lastrites:settings': 'keep' })
    useGuidanceStore.getState().setTutorialDone(new Set([5] as const))
    useIntroStore.getState().setSeen(true)

    expect(canContinue()).toBe(false)
    expect(loadGame()).toBe(false)
    expect(data.get('lastrites:settings')).toBe('keep')
    expect(data.get(SAVE_KEY)).toBe('{not json')
    expect([...useGuidanceStore.getState().tutorialDone]).toEqual([5])
    expect(useIntroStore.getState().seen).toBe(true)
  })
})

describe('save and load: combat block', () => {
  const armedInventory = () => ({
    slots: [
      { item: 'revolver', qty: 1 },
      { item: 'wood-axe', qty: 1 },
      { item: 'revolver-cartridge', qty: 12 },
      { item: 'wood-plank', qty: 3 },
    ],
    keyItems: [],
    relics: [],
    hotbar: [null, null, null, null],
  })

  beforeEach(() => {
    useCombatStore.setState({ firearms: {}, durability: {}, upgrades: [], takenPickups: [] })
    useDoorStore.getState().reset()
    useMysteryStore.getState().reset()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('restores weapons, magazines, ammo, upgrades, durability and boards', () => {
    stubStorage()
    useInventoryStore.getState().setInventory(armedInventory() as never)
    useCombatStore.setState({
      firearms: { revolver: { magazine: 3 } },
      durability: { 'wood-axe': 17 },
      upgrades: ['up-axe-edge'],
      takenPickups: ['revolver', 'wood-axe'],
    })
    useDoorStore.setState({ built: true, doors: { front: [60, 25], vestry: [40, 60, 10] } })
    useMysteryStore.getState().recordCraneRested()
    expect(saveGame()).toBe(true)

    useInventoryStore.getState().setInventory({ ...armedInventory(), slots: [] } as never)
    useCombatStore.setState({ firearms: {}, durability: {}, upgrades: [], takenPickups: [] })
    useDoorStore.getState().reset()
    useMysteryStore.getState().reset()
    expect(loadGame()).toBe(true)

    const c = useCombatStore.getState()
    expect(c.firearms).toEqual({ revolver: { magazine: 3 } })
    expect(c.durability).toEqual({ 'wood-axe': 17 })
    expect(c.upgrades).toEqual(['up-axe-edge'])
    expect(c.takenPickups).toEqual(['revolver', 'wood-axe'])
    const d = useDoorStore.getState()
    expect(d.built).toBe(true)
    expect(d.doors).toEqual({ front: [60, 25], vestry: [40, 60, 10] })
    expect(useInventoryStore.getState().inventory.slots).toContainEqual({
      item: 'revolver-cartridge',
      qty: 12,
    })
    expect(useMysteryStore.getState().mystery.craneRested).toBe(true)
  })

  it('loads a pre-07 save with defaults and craneRested false', () => {
    const data = stubStorage()
    saveGame()
    const file = JSON.parse(data.get(SAVE_KEY)!) as Record<string, Record<string, unknown>>
    delete file.combat
    delete file.mystery.craneRested
    data.set(SAVE_KEY, JSON.stringify(file))
    useCombatStore.setState({ upgrades: ['up-axe-edge'], takenPickups: ['wood-axe'] })
    useMysteryStore.getState().recordCraneRested()

    expect(canContinue()).toBe(true)
    expect(loadGame()).toBe(true)
    const c = useCombatStore.getState()
    expect(c.upgrades).toEqual([])
    expect(c.takenPickups).toEqual([])
    expect(useDoorStore.getState().doors).toEqual({ front: [], vestry: [] })
    expect(useMysteryStore.getState().mystery.craneRested).toBe(false)
  })

  it('hides Continue for corrupt data and leaves storage untouched', () => {
    const data = stubStorage()
    saveGame()
    const file = JSON.parse(data.get(SAVE_KEY)!) as Record<string, unknown>
    file.inventory = 'junk'
    const text = JSON.stringify(file)
    data.set(SAVE_KEY, text)
    useCombatStore.setState({ takenPickups: ['revolver'] })

    expect(canContinue()).toBe(false)
    expect(loadGame()).toBe(false)
    expect(data.get(SAVE_KEY)).toBe(text)
    expect(useCombatStore.getState().takenPickups).toEqual(['revolver'])
  })
})
