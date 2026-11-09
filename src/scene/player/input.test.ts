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

  it('reads rebound reload, kick, dodge and heavy keys', () => {
    const b = { ...bindings, Reload: 'KeyT', Kick: 'KeyG', Dodge: 'KeyX', HeavyAttack: 'KeyB' }
    const i = createInput(() => b)
    i.keyDown('KeyR')
    expect(i.peek()).toMatchObject({ reload: false, kick: false, dodge: false, heavy: false })
    for (const k of ['KeyT', 'KeyG', 'KeyX', 'KeyB']) i.keyDown(k)
    expect(i.peek()).toMatchObject({ reload: true, kick: true, dodge: true, heavy: true })
  })

  it('releases held buttons while the sim is frozen so a charge does not auto-fire', () => {
    let frozen = false
    const i = createInput(() => ({ ...bindings, Attack: 'MouseLeft' }), () => frozen)
    i.mouseDown(0)
    i.keyDown('KeyV')
    expect(i.peek().attack).toBe(true)
    frozen = true
    expect(i.peek().attack).toBe(false)
    frozen = false
    expect(i.peek().attack).toBe(false)
  })

  it('releaseAll clears held keys', () => {
    const i = createInput(() => bindings)
    i.keyDown('ShiftLeft')
    i.releaseAll()
    expect(i.peek().sprint).toBe(false)
  })
})
