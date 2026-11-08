import { beforeEach, describe, expect, it } from 'vitest'
import { clearSubscribers, subscribeToType } from '../events'
import { FIXED_SPAWNS } from '../../data/zones'
import { GATE_DEFS } from '../../data/gateHints'
import { useInventoryStore } from './inventoryStore'
import { useMysteryStore } from './mysteryStore'
import { useToastStore } from './toastStore'

beforeEach(() => {
  clearSubscribers()
  useMysteryStore.getState().reset()
  useToastStore.setState({ queue: [] })
  useInventoryStore.setState((s) => ({ inventory: { ...s.inventory, keyItems: [] } }))
})

describe('interactGate', () => {
  // **Validates: Requirement 2.1**
  it('opens the crypt gate with the key, toasts and captions the unlock', () => {
    const captions: string[] = []
    subscribeToType('subtitleShown', (e) => captions.push(e.text))
    useInventoryStore.getState().addKeyItem('rusted-crypt-key')
    const r = useMysteryStore.getState().interactGate('mausoleum-row', 'gate')
    expect(r.kind).toBe('opened')
    expect(useMysteryStore.getState().mystery.gates['mausoleum-row']).toBe(true)
    expect(useToastStore.getState().queue[0]?.text).toBe(GATE_DEFS['mausoleum-row'].unlockText)
    expect(captions).toEqual([GATE_DEFS['mausoleum-row'].unlockSound])
  })

  // **Validates: Requirement 2.4**
  it('toasts a hint and stays locked without the key', () => {
    useMysteryStore.getState().interactGate('ossuary', 'gate')
    expect(useMysteryStore.getState().mystery.gates.ossuary).toBe(false)
    expect(useToastStore.getState().queue[0]?.text).toBe(GATE_DEFS.ossuary.hintMissingKey)
  })

  // **Validates: Requirement 2.2**
  it('only reveals the catacomb stair at the altar', () => {
    useInventoryStore.getState().addKeyItem('bone-whistle')
    useMysteryStore.getState().interactGate('catacombs', 'gate')
    expect(useMysteryStore.getState().mystery.gates.catacombs).toBe(false)
    useMysteryStore.getState().interactGate('catacombs', 'altar')
    expect(useMysteryStore.getState().mystery.gates.catacombs).toBe(true)
  })
})

describe('key item locations', () => {
  // **Validates: Requirement 2.5**
  it('places each key in its design-bible zone', () => {
    const zoneOf = (item: string) => FIXED_SPAWNS.find((s) => s.item === item)?.zone
    expect(zoneOf('rusted-crypt-key')).toBe('grounds')
    expect(zoneOf('bone-whistle')).toBe('mausoleum-row')
    expect(zoneOf('iron-ossuary-key')).toBe('mausoleum-row')
  })
})
