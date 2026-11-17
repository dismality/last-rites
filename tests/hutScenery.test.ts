// Spec 09 task 11n-b: the hut scene's JSON loads, the hut's items rest on their tables, and the
// way from the spawn to the workbench stays clear.
import { describe, expect, it } from 'vitest'
import { HUT_BOXES, HUT_SURFACES, VENDING_MACHINE } from '../src/data/hutScenery'
import { VENDING_ANCHORS, VENDING_BOX } from '../src/data/vending'
import { BENCH_Z, POWDER_TIN_HUT } from '../src/data/cemeteryLayout'
import { FIXED_SPAWNS, SPAWN_POINTS } from '../src/data/zones'

const inside = (b: (typeof HUT_BOXES)[number], x: number, z: number) =>
  Math.abs(x - b.center[0]) <= b.half[0] && Math.abs(z - b.center[2]) <= b.half[2]
const box = (note: string) => HUT_BOXES.find((b) => b.note.startsWith(note))!

describe('hut scene JSON', () => {
  it('loads 8 finite boxes and the table surfaces', () => {
    expect(HUT_BOXES).toHaveLength(8)
    for (const b of HUT_BOXES) {
      for (const v of [...b.center, ...b.half, b.rotY]) expect(Number.isFinite(v)).toBe(true)
      expect(b.half.every((h) => h > 0)).toBe(true)
    }
    expect(HUT_SURFACES).toEqual({ eastTableY: 0.78, westTableY: 0.78, benchTopY: 0.86 })
  })

  it('the vending machine box is the model footprint at its placement', () => {
    const v = box('vending')
    expect(v.center[0]).toBeCloseTo(VENDING_MACHINE.position[0], 6)
    expect(v.center[2]).toBeCloseTo(VENDING_MACHINE.position[2], 6)
  })

  // Spec 11 task 2.4 (Req 6.1): the machine's own JSON, its anchors and its box match the data.
  it('mirrors the machine JSON anchors and box in data/vending.ts', () => {
    const raw = Object.values(
      import.meta.glob<string>('../public/assets/models/props/vending-machine.json', { query: '?raw', import: 'default', eager: true }),
    )[0]
    const json = JSON.parse(raw) as {
      anchors: Record<string, { position: number[] }>
      boxes: { center: number[]; half: number[] }[]
    }
    expect(json.anchors['marquee-light'].position).toEqual([...VENDING_ANCHORS.marqueeLight])
    expect(json.anchors.tray.position).toEqual([...VENDING_ANCHORS.tray])
    expect(json.anchors['coin-slot'].position).toEqual([...VENDING_ANCHORS.coinSlot])
    VENDING_ANCHORS.handles.forEach((h, i) => expect(json.anchors[`handle-${i}`].position).toEqual([...h]))
    expect(json.boxes[0].center).toEqual([...VENDING_BOX.center])
    expect(json.boxes[0].half).toEqual([...VENDING_BOX.half])
    const v = box('vending')
    // Turned -PI/2 in the hut, so the model's x and z half extents swap.
    expect([v.half[0], v.half[1], v.half[2]].map((x) => Math.round(x * 100) / 100).sort()).toEqual(
      [...VENDING_BOX.half].sort(),
    )
  })
})

describe('hut items rest on their tables', () => {
  const spawn = SPAWN_POINTS.find((p) => p.id === 'hut-shelf')!.position
  const page = FIXED_SPAWNS.find((p) => p.id === 'fx-page-1')!.position

  it('hut-shelf and page 1 on the east table', () => {
    for (const p of [spawn, page]) {
      expect(Math.abs(p[1] - HUT_SURFACES.eastTableY)).toBeLessThanOrEqual(0.03)
      expect(inside(box('east table'), p[0], p[2])).toBe(true)
    }
  })

  it('the powder tin on the west table', () => {
    expect(Math.abs(POWDER_TIN_HUT[1] - HUT_SURFACES.westTableY)).toBeLessThanOrEqual(0.03)
    expect(inside(box('west table'), POWDER_TIN_HUT[0], POWDER_TIN_HUT[2])).toBe(true)
  })
})

describe('the way from the spawn to the bench', () => {
  it('has no hut collider in |x| < 0.7, z -1.8..3', () => {
    for (const b of HUT_BOXES) {
      const overlaps =
        b.center[0] - b.half[0] < 0.7 &&
        b.center[0] + b.half[0] > -0.7 &&
        b.center[2] - b.half[2] < 3 &&
        b.center[2] + b.half[2] > -1.8
      expect(overlaps, b.note).toBe(false)
    }
    expect(BENCH_Z + 0.4).toBeCloseTo(-1.8, 6)
  })
})
