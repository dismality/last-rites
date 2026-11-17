import { beforeEach, describe, expect, it, vi } from 'vitest'
import { lockRequestPending, requestPointerLockUnadjusted, resetLockRequest } from './pointerLockRequest'
import { discardLookWhileOwned } from './viewOwnership'
import { createInput } from './input'

const flush = () => new Promise((r) => setTimeout(r, 0))
const fake = (impl: (o?: unknown) => unknown) => {
  const requestPointerLock = vi.fn(impl)
  return { el: { requestPointerLock } as unknown as Element, calls: requestPointerLock.mock.calls }
}

describe('requestPointerLockUnadjusted', () => {
  beforeEach(resetLockRequest)

  it('asks for unadjusted movement first and does not repeat when it works', async () => {
    const { el, calls } = fake(() => Promise.resolve())
    requestPointerLockUnadjusted(el)
    await flush()
    expect(calls).toEqual([[{ unadjustedMovement: true }]])
  })

  it('falls back to a plain lock on rejection', async () => {
    const { el, calls } = fake((o) => (o ? Promise.reject(new Error('NotSupportedError')) : Promise.resolve()))
    requestPointerLockUnadjusted(el)
    await flush()
    expect(calls).toEqual([[{ unadjustedMovement: true }], []])
  })

  it('falls back when the call throws', () => {
    const { el, calls } = fake((o) => {
      if (o) throw new Error('bad args')
      return undefined
    })
    requestPointerLockUnadjusted(el)
    expect(calls).toEqual([[{ unadjustedMovement: true }], []])
  })

  it('falls back when it returns undefined', () => {
    const { el, calls } = fake(() => undefined)
    requestPointerLockUnadjusted(el)
    expect(calls).toHaveLength(2)
    expect(calls[1]).toEqual([])
  })

  it('never throws, even if the fallback is rejected or throws', async () => {
    const { el } = fake(() => Promise.reject(new Error('no')))
    expect(() => requestPointerLockUnadjusted(el)).not.toThrow()
    await flush()
    const t = fake(() => {
      throw new Error('no')
    })
    expect(() => requestPointerLockUnadjusted(t.el)).not.toThrow()
  })

  // Resume, the cursor relock and the canvas click can all ask in one frame. Chrome rejects the
  // overlapping requests, and the retries fired a lock change with no lock, which paused again.
  it('sends one request at a time and allows the next once the browser answers', async () => {
    let answer: () => void = () => {}
    const { el, calls } = fake(() => new Promise<void>((r) => (answer = r)))
    requestPointerLockUnadjusted(el)
    requestPointerLockUnadjusted(el)
    requestPointerLockUnadjusted(el)
    expect(calls).toHaveLength(1)
    expect(lockRequestPending()).toBe(true)
    answer()
    await flush()
    expect(lockRequestPending()).toBe(false)
    requestPointerLockUnadjusted(el)
    expect(calls).toHaveLength(2)
  })

  it('is free again after a refused request and its fallback', async () => {
    const { el } = fake(() => Promise.reject(new Error('no')))
    requestPointerLockUnadjusted(el)
    await flush()
    await flush()
    expect(lockRequestPending()).toBe(false)
  })
})

describe('look discard while the view is owned', () => {
  const bindings = {}

  it('drops mouse travel collected while a menu or camera owns the view', () => {
    const i = createInput(() => bindings)
    i.mouseMove(40, 20)
    expect(discardLookWhileOwned(true, i)).toBe(true)
    i.mouseMove(3, 1)
    expect(i.sample()).toMatchObject({ lookDX: 3, lookDY: 1 })
  })

  it('keeps look input when the view is not owned', () => {
    const i = createInput(() => bindings)
    i.mouseMove(40, 20)
    expect(discardLookWhileOwned(false, i)).toBe(false)
    expect(i.sample()).toMatchObject({ lookDX: 40, lookDY: 20 })
  })

  it('input filters a lone spike', () => {
    const i = createInput(() => bindings)
    i.mouseMove(2, 0)
    i.mouseMove(6000, 3000)
    i.mouseMove(2, 0)
    expect(i.sample()).toMatchObject({ lookDX: 4, lookDY: 0 })
  })
})
