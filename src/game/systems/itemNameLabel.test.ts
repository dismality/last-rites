import { beforeEach, describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { ITEM_NAME_LABEL } from '../../data/itemLabel'
import { useItemNameStore } from '../state/itemNameStore'
import { useGameStore } from '../state/gameStore'
import { useIntroStore } from '../state/introStore'
import { cinematicActive } from '../state/menuState'
import { itemNameFinished, itemNameOpacity } from './itemNameLabel'

describe('itemNameOpacity', () => {
  it('holds for 2 s, fades over 0.6 s, then is gone', () => {
    expect(itemNameOpacity(0)).toBe(1)
    expect(itemNameOpacity(2000)).toBe(1)
    expect(itemNameOpacity(2300)).toBeCloseTo(0.5)
    expect(itemNameOpacity(2600)).toBe(0)
    expect(itemNameFinished(2600)).toBe(true)
    expect(itemNameFinished(2599)).toBe(false)
  })

  it('fades almost at once with reduced motion', () => {
    expect(itemNameOpacity(2000 + ITEM_NAME_LABEL.reducedFadeMs, true)).toBe(0)
  })

  it('never rises and stays within 0..1', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 5000 }), fc.integer({ min: 0, max: 5000 }), (a, b) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a]
        const oLo = itemNameOpacity(lo)
        const oHi = itemNameOpacity(hi)
        return oHi <= oLo && oLo <= 1 && oHi >= 0
      }),
    )
  })
})

describe('itemNameStore', () => {
  beforeEach(() => useItemNameStore.setState({ name: null, shownAt: 0, ticket: 0 }))

  it('shows an item name from its id', () => {
    useItemNameStore.getState().show('wood-axe', 100)
    expect(useItemNameStore.getState().name).toBe('Wood Axe')
    expect(useItemNameStore.getState().shownAt).toBe(100)
  })

  it('a new name replaces the current at once and restarts the timer', () => {
    const s = useItemNameStore.getState()
    s.show('bone', 100)
    useItemNameStore.getState().show('cloth', 1500)
    const now = useItemNameStore.getState()
    expect(now.name).toBe('Cloth')
    expect(itemNameOpacity(1500 + 2000 - now.shownAt)).toBe(1)
    expect(now.ticket).toBe(2)
  })

  it('showing the same item again also restarts the timer', () => {
    useItemNameStore.getState().show('bone', 100)
    useItemNameStore.getState().show('bone', 900)
    expect(useItemNameStore.getState().shownAt).toBe(900)
  })

  it('an empty slot shows nothing and does not cut the current name', () => {
    useItemNameStore.getState().show('bone', 100)
    useItemNameStore.getState().show(null, 200)
    const s = useItemNameStore.getState()
    expect(s.name).toBe('Bone')
    expect(s.shownAt).toBe(100)
  })

  it('has no leave action: moving the cursor away leaves the timing untouched', () => {
    // Only the timer ends a name; the store exposes show and clear (clear is for tests and resets).
    expect(Object.keys(useItemNameStore.getState()).sort()).toEqual(
      ['clear', 'expire', 'name', 'shownAt', 'show', 'ticket'].sort(),
    )
  })
})

describe('hidden during cinematics', () => {
  it('the label is gated on cinematicActive for the intro and endings', () => {
    useGameStore.setState({ screen: 'game' })
    useIntroStore.setState({ playing: true })
    expect(cinematicActive()).toBe(true)
    useIntroStore.setState({ playing: false })
    useGameStore.setState({ screen: 'ending' })
    expect(cinematicActive()).toBe(true)
    useGameStore.setState({ screen: 'game' })
    expect(cinematicActive()).toBe(false)
  })
})

describe('item names are never title attributes', () => {
  const sources = import.meta.glob('/src/ui/{satchel,merchant,chapel,workbench,hud,journal}/*.tsx', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>
  it('no tsx under item-list UIs uses title= with an item name', () => {
    const offenders: string[] = []
    for (const [file, src] of Object.entries(sources)) {
      for (const m of src.matchAll(/title=\{[^}]*(name|Name)[^}]*\}/g)) offenders.push(`${file}: ${m[0]}`)
    }
    expect(Object.keys(sources).length).toBeGreaterThan(10)
    expect(offenders).toEqual([])
  })
})

describe('itemNameStore.expire', () => {
  it('removes the faded name, but never a newer one that replaced it', () => {
    const s = useItemNameStore.getState()
    s.show('bandage', 0)
    const first = useItemNameStore.getState().ticket
    useItemNameStore.getState().expire(first)
    expect(useItemNameStore.getState().name).toBeNull()

    useItemNameStore.getState().show('bandage', 0)
    const old = useItemNameStore.getState().ticket
    useItemNameStore.getState().show('cloth', 10)
    useItemNameStore.getState().expire(old)
    expect(useItemNameStore.getState().name).toBe('Cloth')
    useItemNameStore.getState().clear()
  })
})
