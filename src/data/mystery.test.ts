import { describe, it, expect } from 'vitest'
import { JOURNAL_PAGES } from './journal'
import { CLUES } from './clues'
import { RELICS } from './relics'
import {
  SCARE_EVENTS,
  SCARE_ZONES,
  TELEGRAPH_LEAD_MIN_S,
  TELEGRAPH_LEAD_MAX_S,
} from './scares'
import { FIXED_SPAWNS } from './zones'

const spawnIds = new Set(FIXED_SPAWNS.map((s) => s.id))

describe('mystery content data', () => {
  it('has five journal pages at real spawns, page 3 teaching the salt circle', () => {
    expect(JOURNAL_PAGES.map((p) => p.id)).toEqual([1, 2, 3, 4, 5])
    for (const p of JOURNAL_PAGES) expect(spawnIds.has(p.location)).toBe(true)
    expect(JOURNAL_PAGES.filter((p) => p.unlocks).map((p) => [p.id, p.unlocks])).toEqual([
      [3, 'r-salt-circle'],
    ])
  })

  it('has five relics at real spawns holding the matching item', () => {
    expect(RELICS).toHaveLength(5)
    for (const r of RELICS) {
      const spawn = FIXED_SPAWNS.find((s) => s.id === r.location)
      expect(spawn?.item).toBe(r.id)
    }
  })

  it('has unique clues, at least six, spread over three zones', () => {
    expect(new Set(CLUES.map((c) => c.id)).size).toBe(CLUES.length)
    expect(CLUES.length).toBeGreaterThanOrEqual(6)
    expect(new Set(CLUES.map((c) => c.zone)).size).toBeGreaterThanOrEqual(3)
  })

  it('has eight scare events with telegraph leads in range', () => {
    expect(SCARE_EVENTS).toHaveLength(8)
    for (const e of SCARE_EVENTS) {
      expect(e.telegraph.lead).toBeGreaterThanOrEqual(TELEGRAPH_LEAD_MIN_S)
      expect(e.telegraph.lead).toBeLessThanOrEqual(TELEGRAPH_LEAD_MAX_S)
      expect(e.weight).toBeGreaterThan(0)
      expect(e.subtitle.length).toBeGreaterThan(0)
    }
  })

  it('has scare zones that reference known events and start with statue-turn on the grounds', () => {
    const ids = new Set(SCARE_EVENTS.map((e) => e.id))
    for (const z of SCARE_ZONES) {
      expect(z.events.length).toBeGreaterThan(0)
      for (const id of z.events) expect(ids.has(id)).toBe(true)
      for (let i = 0; i < 3; i++) expect(z.bounds.min[i]).toBeLessThan(z.bounds.max[i])
    }
    expect(SCARE_ZONES.filter((z) => z.zone === 'grounds')).toHaveLength(2)
    expect(SCARE_ZONES.find((z) => z.zone === 'grounds')?.events).toContain('statue-turn')
  })
})
