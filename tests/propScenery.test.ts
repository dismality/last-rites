import { SCARE_STATUES } from '../src/data/scares'
// Spec 09 task 11n-d: the props' JSON loads, the three weapon rests sit on their surfaces, and the
// colliders this task added stay out of the chapel aisle and the hut's spawn-to-bench path.
import { describe, expect, it } from 'vitest'
import { CLUE_MODEL_IDS, PROP_IDS, allModelUrls, clueModelUrl, propModelUrl } from '../src/data/assets'
import { CRANE_CRYPT_STEP, LODGE, WOODPILE_POSITION } from '../src/data/cemeteryLayout'
import { WEAPON_PICKUP_POSES } from '../src/data/itemModels'
import {
  AXE_REST,
  LODGE_TABLE_BOXES,
  PROP_PLACEMENTS,
  PROP_SURFACES,
  SABRE_PLINTH_BOXES,
  WOODPILE_BOXES,
} from '../src/data/propScenery'
import { CLUE_SPOTS } from '../src/data/tombstones'

// Vite resolves these at build time: the GLBs as URLs only (never decoded), the JSON as objects.
const glbs = import.meta.glob('../public/assets/models/props/*.glb', { query: '?url', eager: true })
const jsons = import.meta.glob('../public/assets/models/props/*.json', { eager: true })
const name = (path: string) => path.replace(/^.*\//, '').replace(/\.(glb|json)$/, '')

describe('prop files', () => {
  it('every prop and clue GLB exists, and every JSON beside one loads', () => {
    const have = new Set(Object.keys(glbs).map(name))
    const ids = [...PROP_IDS, ...CLUE_MODEL_IDS]
    for (const id of ids) expect(have.has(id), id).toBe(true)
    for (const [path, mod] of Object.entries(jsons)) {
      const raw = mod as { boxes?: unknown[]; anchors?: object }
      expect(raw.boxes !== undefined || raw.anchors !== undefined, name(path)).toBe(true)
    }
    // A JSON exists beside every prop that has colliders or anchors the game reads.
    for (const id of ['lamp-post', 'merchant-cart', 'statue-mourner', 'woodpile', 'lodge-table', 'sabre-plinth'])
      expect(Object.keys(jsons).map(name), id).toContain(id)
  })

  it('every clue spot has its own model and everything is preloaded', () => {
    for (const c of CLUE_SPOTS) expect(CLUE_MODEL_IDS).toContain(c.clueId)
    const all = allModelUrls()
    for (const id of PROP_IDS) expect(all).toContain(propModelUrl(id))
    for (const id of CLUE_MODEL_IDS) expect(all).toContain(clueModelUrl(id))
  })
})

describe('weapons rest on their surfaces', () => {
  const within = (a: number, b: number) => Math.abs(a - b) <= 0.03
  const topOf = (boxes: readonly { center: readonly number[]; half: readonly number[] }[]) =>
    Math.max(...boxes.map((b) => b.center[1] + b.half[1]))

  it('the shotgun on the lodge table', () => {
    const y = LODGE.center[1] + WEAPON_PICKUP_POSES.shotgun.surface[1]
    expect(within(y, PROP_SURFACES.lodgeTableTopY)).toBe(true)
    expect(within(y, topOf(LODGE_TABLE_BOXES))).toBe(true)
  })

  it('the sabre on its plinth (the plinth stands on the ground under the step)', () => {
    const y = CRANE_CRYPT_STEP[1] + WEAPON_PICKUP_POSES['silver-sabre'].surface[1]
    expect(within(y, PROP_SURFACES.sabrePlinthTopY)).toBe(true)
    expect(within(y, topOf(SABRE_PLINTH_BOXES))).toBe(true)
  })

  it('the axe on the chopping block, at the axe-rest anchor', () => {
    const s = WEAPON_PICKUP_POSES['wood-axe'].surface
    expect([...s]).toEqual([...AXE_REST])
    const block = WOODPILE_BOXES.find((b) => b.note === 'chopping block')!
    expect(within(WOODPILE_POSITION[1] + s[1], block.center[1] + block.half[1])).toBe(true)
    expect(Math.abs(s[0] - block.center[0])).toBeLessThanOrEqual(block.half[0])
    expect(Math.abs(s[2] - block.center[2])).toBeLessThanOrEqual(block.half[2])
  })
})

describe('added colliders keep the key routes clear', () => {
  it('has the statues, woodpile, lodge table and notice post', () => {
    const notes = PROP_PLACEMENTS.map((p) => p.note)
    expect(notes.filter((n) => n.startsWith('statue'))).toHaveLength(SCARE_STATUES.length)
    expect(notes.some((n) => n.startsWith('woodpile'))).toBe(true)
    expect(notes.some((n) => n.startsWith('lodge table'))).toBe(true)
    expect(notes.some((n) => n.startsWith('notice post'))).toBe(true)
  })

  it('none sits in the chapel aisle (x 9.3..10.7, z -1..9.5) or the hut spawn-to-bench path', () => {
    for (const p of PROP_PLACEMENTS) {
      const [cx, , cz] = p.position
      const [hx, , hz] = p.half
      const overlap = (x0: number, x1: number, z0: number, z1: number) =>
        cx - hx < x1 && cx + hx > x0 && cz - hz < z1 && cz + hz > z0
      expect(overlap(9.3, 10.7, -1, 9.5), p.note).toBe(false)
      expect(overlap(-0.7, 0.7, -1.8, 3), p.note).toBe(false)
    }
  })
})
