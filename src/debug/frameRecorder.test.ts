import { createFrameBuffer } from './frameRecorder'
import { toSnapshot } from './debugHook'
import { isCanvasLocked, lockOverride } from '../scene/player/pointerLockOverride'

describe('frame buffer', () => {
  it('reports the longest frame inside the window and forgets old frames', () => {
    const b = createFrameBuffer(1000)
    b.push(100, 16)
    b.push(200, 90)
    b.push(1500, 17)
    expect(b.longest(1500, 400)).toBe(17)
    expect(b.longest(1500)).toBe(17) // the 90 ms frame is older than keepMs and was dropped
    b.reset()
    expect(b.longest(1500)).toBe(0)
  })
})

describe('toSnapshot', () => {
  it('makes Sets arrays, drops functions and survives Infinity', () => {
    const snap = toSnapshot({ s: new Set(['a']), f: () => 1, n: Infinity, k: 2 })
    expect(snap).toEqual({ s: ['a'], n: 'Infinity', k: 2 })
  })
})

describe('pointer lock override', () => {
  it('only counts as locked when enabled', () => {
    expect(isCanvasLocked(null)).toBe(false)
    lockOverride.enabled = true
    expect(isCanvasLocked(null)).toBe(true)
    lockOverride.enabled = false
  })
})
