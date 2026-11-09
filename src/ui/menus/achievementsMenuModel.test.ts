import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { ACHIEVEMENTS } from '../../data/achievements'
import { achievementsMenuModel } from './achievementsMenuModel'

describe('achievementsMenuModel', () => {
  it('lists all 12 entries', () => {
    expect(achievementsMenuModel([], false).entries).toHaveLength(12)
  })

  it('tags locked entries and leaves unlocked ones untagged', () => {
    const m = achievementsMenuModel(['a-rest'], false)
    expect(m.entries.find((e) => e.id === 'a-rest')).toMatchObject({ unlocked: true, tag: null })
    const locked = m.entries.filter((e) => !e.unlocked)
    expect(locked).toHaveLength(11)
    expect(locked.every((e) => e.tag === 'Locked' && e.goal.length > 0)).toBe(true)
  })

  it('stays closed and says "Not now" during a major scare', () => {
    const m = achievementsMenuModel([], true)
    expect(m.open).toBe(false)
    expect(m.notNow).toBe('Not now')
    expect(achievementsMenuModel([], false)).toMatchObject({ open: true, notNow: null })
  })

  it('every entry is tagged exactly when locked', () => {
    fc.assert(
      fc.property(fc.subarray(ACHIEVEMENTS.map((a) => a.id)), (ids) => {
        const m = achievementsMenuModel(ids, false)
        return m.entries.every((e) => (e.tag !== null) === !ids.includes(e.id))
      }),
    )
  })
})
