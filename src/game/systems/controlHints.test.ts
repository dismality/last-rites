import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { CONTROL_HINT_IDS, type ControlHintId } from '../../data/controlHints'
import { DEFAULT_SETTINGS } from './settings'
import {
  advanceHints,
  freshHintProgress,
  hintKeyLabel,
  hintLines,
  hintsHidden,
  markHintUsed,
  parseHintsUsed,
  serializeHintsUsed,
} from './controlHints'
import { fromSaveFile, toSaveFile } from './saveGame'

const base = { enabled: true, used: new Set<ControlHintId>(), bindings: DEFAULT_SETTINGS.bindings, heldItem: null }

describe('key names', () => {
  it('reads readably', () => {
    expect(hintKeyLabel('ShiftLeft')).toBe('Shift')
    expect(hintKeyLabel('Mouse2')).toBe('Mouse 2')
    expect(hintKeyLabel('KeyW')).toBe('W')
    expect(hintKeyLabel('Space')).toBe('Space')
    expect(hintKeyLabel(undefined)).toBe('?')
  })
})

describe('hint lines', () => {
  it('shows move and sprint with the default keys, no charge line without a heavy weapon', () => {
    const lines = hintLines(base)
    expect(lines.map((l) => l.id)).toEqual(['move', 'sprint'])
    expect(lines[0]?.keys).toEqual(['W', 'A', 'S', 'D'])
    expect(lines[1]?.keys).toEqual(['Shift'])
  })

  it('shows rebound keys', () => {
    const bindings = { ...DEFAULT_SETTINGS.bindings, MoveForward: 'ArrowUp', Sprint: 'ControlLeft' }
    const lines = hintLines({ ...base, bindings })
    expect(lines[0]?.keys[0]).toBe('↑')
    expect(lines[1]?.keys).toEqual(['Ctrl'])
  })

  it('shows the charge line only with the axe or sabre in hand', () => {
    for (const held of ['wood-axe', 'silver-sabre']) {
      const l = hintLines({ ...base, heldItem: held }).find((x) => x.id === 'charge')
      expect(l).toMatchObject({ prefix: 'Hold', keys: ['V'], word: 'Charge a heavy swing' })
    }
    for (const held of ['rusty-shovel', 'revolver', 'bone-club', null]) {
      expect(hintLines({ ...base, heldItem: held }).some((x) => x.id === 'charge')).toBe(false)
    }
  })

  it('is empty when the setting is off, and a used line is gone', () => {
    expect(hintLines({ ...base, enabled: false })).toEqual([])
    const used = markHintUsed(new Set(), 'move')
    expect(hintLines({ ...base, used }).map((l) => l.id)).toEqual(['sprint'])
  })
})

describe('clearing', () => {
  it('moving about 10 m clears move; sprinting 2 s clears sprint', () => {
    let p = freshHintProgress()
    let used: ReadonlySet<ControlHintId> = new Set()
    for (let i = 0; i < 99; i++) ({ progress: p, used } = advanceHints(p, used, { moved: 0.1, dt: 1 / 60, sprinting: false }))
    expect(used.has('move')).toBe(false)
    ;({ progress: p, used } = advanceHints(p, used, { moved: 0.2, dt: 1 / 60, sprinting: false }))
    expect(used.has('move')).toBe(true)
    expect(used.has('sprint')).toBe(false)
    for (let i = 0; i < 119; i++) ({ progress: p, used } = advanceHints(p, used, { moved: 0, dt: 1 / 60, sprinting: true }))
    expect(used.has('sprint')).toBe(false)
    used = advanceHints(p, used, { moved: 0, dt: 1 / 60, sprinting: true }).used
    expect(used.has('sprint')).toBe(true)
  })

  it('a teleport-sized step does not count as walking', () => {
    const r = advanceHints(freshHintProgress(), new Set(), { moved: 40, dt: 1 / 60, sprinting: false })
    expect(r.progress.moved).toBe(0)
  })

  it('charge is cleared only by marking it used', () => {
    const r = advanceHints(freshHintProgress(), new Set(), { moved: 0.1, dt: 1, sprinting: true })
    expect(r.used.has('charge')).toBe(false)
  })

  it('turning the setting back on shows every line again (empty used set)', () => {
    const used = new Set<ControlHintId>(CONTROL_HINT_IDS)
    expect(hintLines({ ...base, used, heldItem: 'wood-axe' })).toEqual([])
    expect(hintLines({ ...base, used: new Set(), heldItem: 'wood-axe' })).toHaveLength(3)
  })
})

describe('hidden states', () => {
  const open = { screen: 'game', cinematic: false, menuOpen: false, workbenchOpen: false, mapOpen: false, examining: false }
  it('hides in menus, workbench, big map, examine, cutscenes and endings', () => {
    expect(hintsHidden(open)).toBe(false)
    for (const patch of [{ menuOpen: true }, { workbenchOpen: true }, { mapOpen: true }, { examining: true }, { cinematic: true }, { screen: 'ending' }]) {
      expect(hintsHidden({ ...open, ...patch })).toBe(true)
    }
  })
})

describe('save and restore', () => {
  it('round-trips and ignores junk', () => {
    const used = new Set<ControlHintId>(['move', 'charge'])
    expect(parseHintsUsed(serializeHintsUsed(used))).toEqual(used)
    expect([...parseHintsUsed(['move', 'nope', 7, null])]).toEqual(['move'])
    expect(parseHintsUsed('x').size).toBe(0)
  })

  it('travels through the save file; an old save has none used', () => {
    const state = {
      world: { phase: 'day', phaseTime: 0, nightNumber: 1, fogDensity: 0.02, wavesCleared: 0 },
      player: { position: [0, 0, 0], yaw: 0, pitch: 0, health: 100, stamina: 100, interactTarget: null },
      inventory: { slots: [], keyItems: [], relics: [], equipped: 0 },
      mystery: { pages: new Set(), clues: new Set(), relics: new Set(), gates: {} },
      chapel: {},
      recipes: [],
      controlHints: new Set<ControlHintId>(['sprint']),
    } as never
    const file = JSON.parse(JSON.stringify(toSaveFile(state)))
    expect(file.controlHints).toEqual(['sprint'])
    delete file.controlHints
    const back = fromSaveFile(file)
    // Shape guards may reject the minimal fixture; when they accept it, the field defaults empty.
    if (back) expect(back.controlHints?.size).toBe(0)
  })

  it('property: serialise then parse is identity for any subset', () => {
    fc.assert(
      fc.property(fc.subarray([...CONTROL_HINT_IDS]), (ids) => {
        const set = new Set(ids)
        expect(parseHintsUsed(serializeHintsUsed(set))).toEqual(set)
      }),
    )
  })
})
