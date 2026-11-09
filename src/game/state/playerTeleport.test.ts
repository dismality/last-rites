import fc from 'fast-check'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadGame, saveGame } from './gameSave'
import { usePlayerStore } from './playerStore'
import { queueTeleport, takeTeleport } from './playerTeleport'
import { resetRun } from './resetRun'
import { retryNight, saveDuskSnapshot } from './retryNight'

function fakeStorage(): Storage {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    get length() {
      return m.size
    },
  } as Storage
}

/** Mirrors the controller's frame: consume a teleport, else the body writes its own position. */
function frame(body: { pos: [number, number, number] }): void {
  const tp = takeTeleport()
  if (tp) body.pos = [...tp.position]
  usePlayerStore.getState().setPosition([...body.pos])
}

describe('player teleport', () => {
  beforeEach(() => {
    vi.stubGlobal('sessionStorage', fakeStorage())
    vi.stubGlobal('localStorage', fakeStorage())
    resetRun()
    takeTeleport()
  })

  afterEach(() => vi.unstubAllGlobals())

  afterEach(() => vi.unstubAllGlobals())

  it('applies exactly once', () => {
    queueTeleport({ position: [1, 2, 3], yaw: 0.5, pitch: -0.2 })
    expect(takeTeleport()).toEqual({ position: [1, 2, 3], yaw: 0.5, pitch: -0.2 })
    expect(takeTeleport()).toBeNull()
  })

  it('retry queues the dusk position and the stale body does not overwrite it', () => {
    fc.assert(
      fc.property(
        fc.tuple(fc.integer({ min: -40, max: 40 }), fc.integer({ min: -40, max: 40 })),
        fc.tuple(fc.integer({ min: -40, max: 40 }), fc.integer({ min: -40, max: 40 })),
        ([dx, dz], [ox, oz]) => {
          takeTeleport()
          usePlayerStore.getState().setPosition([dx, 0.05, dz])
          usePlayerStore.getState().setYaw(1.25)
          expect(saveDuskSnapshot()).toBe(true)
          // Died elsewhere: body and store both there.
          usePlayerStore.getState().setPosition([ox, 0.05, oz])
          const body = { pos: [ox, 0.05, oz] as [number, number, number] }
          retryNight()
          frame(body)
          frame(body)
          expect(usePlayerStore.getState().position).toEqual([dx, 0.05, dz])
          expect(usePlayerStore.getState().yaw).toBe(1.25)
          expect(body.pos).toEqual([dx, 0.05, dz])
        },
      ),
      { numRuns: 20 },
    )
  })

  it('Continue queues the saved position', () => {
    usePlayerStore.getState().setPosition([7, 0.05, -9])
    saveGame()
    usePlayerStore.getState().setPosition([0, 0.05, 0])
    takeTeleport()
    expect(loadGame()).toBe(true)
    expect(takeTeleport()?.position).toEqual([7, 0.05, -9])
  })

  it('New Game queues the start position', () => {
    usePlayerStore.getState().setPosition([5, 0.05, 5])
    takeTeleport()
    resetRun()
    expect(takeTeleport()?.position).toEqual(usePlayerStore.getState().position)
  })
})
