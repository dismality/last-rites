import { beforeEach, describe, expect, it } from 'vitest'
import { MERCHANT_SPOT } from '../../data/merchant'
import { clearSubscribers, subscribe } from '../events'
import { buildCompassMarkers } from '../systems/compass'
import { promptText } from '../systems/interaction'
import { isMerchantPresent, syncMerchantPresence, tryTrade } from './merchantPresence'
import { useOverlayStore } from './overlayStore'
import { usePlayerStore } from './playerStore'
import { useProgressionStore } from './progressionStore'
import { useWorldStore } from './worldStore'

const [sx, , sz] = MERCHANT_SPOT.silas
const stock = { rows: [{ id: 'bandage' as const, qty: 3 }] }

const place = (dx: number): void =>
  usePlayerStore.setState({ position: [sx + dx, 1.7, sz] })

beforeEach(() => {
  clearSubscribers()
  useWorldStore.setState({ phase: 'day', phaseTime: 10 })
  useProgressionStore.setState({ stock })
  useOverlayStore.setState({ merchantOpen: false })
  place(1)
})

describe('merchant presence', () => {
  it('prompt reads "E: Trade" and the menu opens within 2.5 m', () => {
    expect(promptText('trade', 'KeyE')).toBe('E: Trade')
    expect(tryTrade()).toBe(true)
    expect(useOverlayStore.getState().merchantOpen).toBe(true)
  })

  it('refuses beyond 2.5 m, at dusk, or after he leaves', () => {
    place(2.6)
    expect(tryTrade()).toBe(false)
    place(1)
    useWorldStore.setState({ phase: 'dusk' })
    expect(tryTrade()).toBe(false)
    useWorldStore.setState({ phase: 'day', phaseTime: 90 })
    expect(tryTrade()).toBe(false)
    expect(useOverlayStore.getState().merchantOpen).toBe(false)
  })

  it('shows the Silas marker only while he is present', () => {
    const ctx = { player: { x: 0, z: 0 }, heading: 0, phase: 'day' as const, bellBuilt: false }
    const ids = (present: boolean) =>
      buildCompassMarkers({ ...ctx, merchant: present ? MERCHANT_SPOT.silas : undefined }).map((m) => m.id)
    expect(ids(true)).toContain('merchant')
    expect(ids(false)).not.toContain('merchant')
    const m = buildCompassMarkers({ ...ctx, merchant: MERCHANT_SPOT.silas }).find((x) => x.id === 'merchant')
    expect([m?.glyph, m?.label]).toEqual(['⚱', 'Silas'])
  })

  it('announces arrival and leaving and closes an open menu when he goes', () => {
    const lines: string[] = []
    subscribe((e) => {
      if (e.type === 'subtitleShown') lines.push(e.text)
    })
    useWorldStore.setState({ phaseTime: 95 })
    let was = syncMerchantPresence(true)
    expect(was).toBe(false)

    useWorldStore.setState({ phaseTime: 1 })
    was = syncMerchantPresence(was)
    expect(was).toBe(true)
    expect(isMerchantPresent()).toBe(true)
    tryTrade()
    expect(useOverlayStore.getState().merchantOpen).toBe(true)

    useWorldStore.setState({ phase: 'dusk' })
    expect(syncMerchantPresence(was)).toBe(false)
    expect(useOverlayStore.getState().merchantOpen).toBe(false)
    expect(lines).toEqual([
      '[the hearse cart rolls away]',
      '[a hearse cart creaks to the gate]',
      '[the hearse cart rolls away]',
    ])
  })
})
