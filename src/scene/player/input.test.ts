import { describe, expect, it } from 'vitest'
import { createInput } from './input'

const bindings = { MoveForward: 'KeyW', MoveBackward: 'KeyS', MoveLeft: 'KeyA', MoveRight: 'KeyD', Sprint: 'ShiftLeft' }

describe('input', () => {
  it('maps codes to actions and combines opposing keys', () => {
    const i = createInput(() => bindings)
    i.keyDown('KeyW')
    i.keyDown('KeyD')
    expect(i.peek()).toMatchObject({ forward: 1, strafe: 1, sprint: false })
    i.keyDown('KeyS')
    expect(i.peek().forward).toBe(0)
  })

  it('honours rebinding immediately', () => {
    let b = { ...bindings }
    const i = createInput(() => b)
    i.keyDown('ArrowUp')
    expect(i.peek().forward).toBe(0)
    b = { ...b, MoveForward: 'ArrowUp' }
    expect(i.peek().forward).toBe(1)
  })

  it('sample consumes look deltas, peek does not', () => {
    const i = createInput(() => bindings)
    i.mouseMove(3, 4)
    i.mouseMove(1, 1)
    expect(i.peek().lookDX).toBe(4)
    expect(i.sample()).toMatchObject({ lookDX: 4, lookDY: 5 })
    expect(i.peek().lookDX).toBe(0)
  })

  it('releaseAll clears held keys', () => {
    const i = createInput(() => bindings)
    i.keyDown('ShiftLeft')
    i.releaseAll()
    expect(i.peek().sprint).toBe(false)
  })
})
