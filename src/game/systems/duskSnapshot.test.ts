import { describe, expect, it } from 'vitest'
import { loadSnapshot, pickData, saveSnapshot } from './duskSnapshot'

function memoryStorage() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
}

describe('duskSnapshot', () => {
  it('pickData drops functions, sets and omitted keys', () => {
    const data = pickData({ a: 1, f: () => 1, s: new Set([1]), skip: 2 }, ['skip'])
    expect(data).toEqual({ a: 1 })
  })

  it('round-trips through storage', () => {
    const storage = memoryStorage()
    expect(saveSnapshot(storage, { player: { health: 70 } })).toBe(true)
    expect(loadSnapshot(storage)).toEqual({ player: { health: 70 } })
  })

  it('survives failing or corrupt storage', () => {
    const throwing = {
      setItem: () => {
        throw new Error('quota')
      },
      getItem: () => '{bad',
    }
    expect(saveSnapshot(throwing, {})).toBe(false)
    expect(loadSnapshot(throwing)).toBeNull()
    expect(saveSnapshot(undefined, {})).toBe(false)
    expect(loadSnapshot(undefined)).toBeNull()
  })
})
