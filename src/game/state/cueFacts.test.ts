import { beforeEach, describe, expect, it } from 'vitest'
import { createDigState } from '../systems/dig'
import { readCueFacts } from './cueFacts'
import { useDigStore } from './digStore'
import { useInventoryStore } from './inventoryStore'
import { useMysteryStore } from './mysteryStore'
import { resetRun } from './resetRun'
import { useSpawnStore } from './spawnStore'
import { useTombstoneStore } from './tombstoneStore'
import { useWorldStore } from './worldStore'

beforeEach(() => {
  resetRun()
})

describe('cue facts follow the stores, so every reset path restores the cues', () => {
  it('a grave dug today is used up; the next day brings it back', () => {
    const day = useWorldStore.getState().nightNumber
    useDigStore.setState({ dig: { ...createDigState(), dugOnDay: { 'grave-a': day } } })
    expect(readCueFacts('grave-mound', 'grave-a').usedUp).toBe(true)
    expect(readCueFacts('grave-mound', 'grave-b').usedUp).toBe(false)
    useWorldStore.getState().setNightNumber(day + 1)
    expect(readCueFacts('grave-mound', 'grave-a').usedUp).toBe(false)
  })

  it('a grave with no shovel in hand says what is needed', () => {
    useInventoryStore.setState({ equippedSlot: null })
    const facts = readCueFacts('grave-mound', 'grave-a')
    expect(facts.usedUp).toBe(false)
    expect(facts.need).toMatch(/shovel/)
  })

  it('a taken stack is used up and New Game brings it back', () => {
    const before = useSpawnStore.getState().world.materials['hut-shelf']
    expect(before.length).toBeGreaterThan(0)
    const last = before.length - 1
    expect(readCueFacts('material-pickup', `hut-shelf:${last}`).usedUp).toBe(false)
    useSpawnStore.setState((s) => ({
      world: { ...s.world, materials: { ...s.world.materials, 'hut-shelf': before.slice(0, last) } },
    }))
    expect(readCueFacts('material-pickup', `hut-shelf:${last}`).usedUp).toBe(true)
    resetRun()
    expect(readCueFacts('material-pickup', `hut-shelf:${last}`).usedUp).toBe(false)
  })

  it('a gate says which key it needs, opens, and closes again on New Game', () => {
    expect(readCueFacts('gate', 'mausoleum-row').need).toBe('the Rusted Crypt Key')
    useInventoryStore.getState().addKeyItem('rusted-crypt-key')
    expect(readCueFacts('gate', 'mausoleum-row')).toEqual({ usedUp: false })
    useMysteryStore.getState().interactGate('mausoleum-row', 'gate')
    expect(readCueFacts('gate', 'mausoleum-row').usedUp).toBe(true)
    resetRun()
    expect(readCueFacts('gate', 'mausoleum-row').usedUp).toBe(false)
  })

  it('the catacomb stair gate points the player to the altar once the whistle is held', () => {
    useInventoryStore.getState().addKeyItem('bone-whistle')
    expect(readCueFacts('gate', 'catacombs').need).toMatch(/altar/)
    expect(readCueFacts('altar-whistle').usedUp).toBe(false)
    useMysteryStore.getState().interactGate('catacombs', 'altar')
    expect(readCueFacts('altar-whistle').usedUp).toBe(true)
  })

  it('a clue is used up once recorded', () => {
    expect(readCueFacts('clue-spot', 'clue-hut-boots').usedUp).toBe(false)
    useMysteryStore.getState().discoverClue('clue-hut-boots')
    expect(readCueFacts('clue-spot', 'clue-hut-boots').usedUp).toBe(true)
  })

  it('a tombstone keeps its prompt but goes idle once read', () => {
    expect(readCueFacts('tombstone', 'marsh').idle).toBe(false)
    useTombstoneStore.getState().open('marsh')
    useTombstoneStore.getState().close()
    expect(readCueFacts('tombstone', 'marsh')).toEqual({ usedUp: false, idle: true })
    resetRun()
    expect(readCueFacts('tombstone', 'marsh').idle).toBe(false)
  })

  it('a stone with a new clue (ledger now held) is not idle again', () => {
    useTombstoneStore.getState().open('hale')
    useTombstoneStore.getState().close()
    expect(readCueFacts('tombstone', 'hale').idle).toBe(true)
    useInventoryStore.getState().addKeyItem('parish-ledger')
    expect(readCueFacts('tombstone', 'hale').idle).toBe(false)
  })

  it('the workbench never goes idle or used up', () => {
    expect(readCueFacts('workbench')).toEqual({ usedUp: false })
  })
})
