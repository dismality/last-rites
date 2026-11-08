import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { isGateOpen, tryOpenGate } from './gates'
import { createMysteryState, MYSTERY_GATE_KEYS, type MysteryGateId } from './mystery'
import { GATE_DEFS } from '../../data/gateHints'
import { buildFenceSegments, generateHeadstones, GROUNDS_HALF, HEADSTONE } from '../../data/cemeteryLayout'
import type { KeyItemId } from '../types'

const ALL_KEYS: KeyItemId[] = ['rusted-crypt-key', 'bone-whistle', 'iron-ossuary-key']
const GATES = Object.keys(GATE_DEFS) as MysteryGateId[]

describe('tryOpenGate', () => {
  it('opens the crypt gate and the ossuary door at the gate with the right key', () => {
    const s0 = createMysteryState()
    const crypt = tryOpenGate(s0, 'mausoleum-row', 'gate', { keyItems: ['rusted-crypt-key'] })
    expect(crypt.kind).toBe('opened')
    expect(isGateOpen(crypt.state, 'mausoleum-row')).toBe(true)
    const door = tryOpenGate(s0, 'ossuary', 'gate', { keyItems: ['iron-ossuary-key'] })
    expect(door.kind).toBe('opened')
  })

  it('reveals the catacomb stair only when the whistle is used at the altar', () => {
    const s0 = createMysteryState()
    const inv = { keyItems: ['bone-whistle'] as KeyItemId[] }
    const atGate = tryOpenGate(s0, 'catacombs', 'gate', inv)
    expect(atGate.kind).toBe('hint')
    expect(isGateOpen(atGate.state, 'catacombs')).toBe(false)
    const atAltar = tryOpenGate(s0, 'catacombs', 'altar', inv)
    expect(atAltar.kind).toBe('opened')
    expect(isGateOpen(atAltar.state, 'catacombs')).toBe(true)
  })

  it('shows a hint toward the key when it is missing', () => {
    const r = tryOpenGate(createMysteryState(), 'mausoleum-row', 'gate', { keyItems: [] })
    expect(r).toMatchObject({ kind: 'hint', text: GATE_DEFS['mausoleum-row'].hintMissingKey })
    expect(r.state.gates['mausoleum-row']).toBe(false)
  })

  it('reports an already-open gate without changing state', () => {
    const open = tryOpenGate(createMysteryState(), 'ossuary', 'gate', { keyItems: ['iron-ossuary-key'] }).state
    const again = tryOpenGate(open, 'ossuary', 'gate', { keyItems: [] })
    expect(again.kind).toBe('already-open')
    expect(again.state).toBe(open)
  })

  // **Validates: Requirements 2.1, 2.3, 2.4**
  it('opens a gate only when its own key is held', () => {
    fc.assert(
      fc.property(fc.constantFrom(...GATES), fc.subarray(ALL_KEYS), (gate, held) => {
        const r = tryOpenGate(createMysteryState(), gate, GATE_DEFS[gate].site, { keyItems: held })
        const hasKey = held.includes(MYSTERY_GATE_KEYS[gate])
        expect(r.kind).toBe(hasKey ? 'opened' : 'hint')
        expect(r.state.gates[gate]).toBe(hasKey)
      }),
    )
  })

  // **Validates: Requirement 2.4**
  it('every gate has a non-empty hint', () => {
    for (const gate of GATES) expect(GATE_DEFS[gate].hintMissingKey.length).toBeGreaterThan(10)
  })
})

describe('layout invariants', () => {
  it('keeps headstones off the fence line', () => {
    const half = GROUNDS_HALF
    for (const h of generateHeadstones()) {
      expect(Math.abs(h.position[0])).toBeLessThan(half)
      expect(Math.abs(h.position[2])).toBeLessThan(half)
    }
    expect(HEADSTONE).toBeDefined()
    expect(buildFenceSegments().length).toBeGreaterThan(0)
  })
})
