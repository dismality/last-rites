// A1: the panel must reach every point the playtest list names. Generated from the world data,
// so these checks fail if a spawn, grave or zone is renamed or removed.
import { describe, expect, it } from 'vitest'
import { SCARE_ZONES } from '../data/scares'
import { TELEPORT_GROUPS, TELEPORT_POINTS } from './devData'

const group = (title: string) => {
  const g = TELEPORT_GROUPS.find((x) => x.title === title)
  if (!g) throw new Error(`missing group ${title}`)
  return g.points
}

describe('Dev_Panel teleports', () => {
  it('covers the crypt key and whistle at the playtest coordinates, 1 m south and facing them', () => {
    const story = group('Story spots')
    const key = story.find((p) => p.id === 'fx-crypt-key')!
    const whistle = story.find((p) => p.id === 'fx-bone-whistle')!
    expect([key.x, key.z, key.yaw]).toEqual([-12, -17, 0])
    expect([whistle.x, whistle.z, whistle.yaw]).toEqual([-21, -47, 0])
    expect(story.some((p) => p.id === 'catacomb-stair')).toBe(true)
  })

  it('has all 5 relics, the 3 diggable graves and every scare zone', () => {
    expect(group('Relics')).toHaveLength(5)
    expect(group('Diggable graves').map((p) => p.id).sort()).toEqual([
      'grave-low-field',
      'grave-north-row',
      'grave-oak-hollow',
    ])
    expect(group('Scare zones (centre)')).toHaveLength(SCARE_ZONES.length)
  })

  it('keeps the hand-placed points (hut, altar, workbench, row mouth, Crane crypt)', () => {
    const ids = TELEPORT_POINTS.map((p) => p.id)
    for (const id of ['hut', 'chapel-altar', 'workbench', 'row-mouth', 'crane-crypt']) {
      expect(ids).toContain(id)
    }
  })

  it('every id is unique and every coordinate finite', () => {
    const all = [...TELEPORT_POINTS, ...TELEPORT_GROUPS.flatMap((g) => g.points)]
    expect(new Set(all.map((p) => p.id)).size).toBe(all.length)
    for (const p of all) expect(Number.isFinite(p.x) && Number.isFinite(p.z) && Number.isFinite(p.yaw)).toBe(true)
  })
})
