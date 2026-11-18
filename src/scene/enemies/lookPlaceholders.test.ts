import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { BRUTE_MODEL_URL, ZOMBIE_MODEL_URL } from '../../data/assets'
import { LOOK_MESH_PLACEHOLDERS, lookMeshWaitingKey } from '../../data/placeholders'
import { lookIndex, lookMeshName, resetClipWarnings, resolveClip, visibleMeshNames } from '../../game/systems/lookVariant'
import { registerMissingArt, waitingPaths } from '../../game/state/waitingList'
import { probe } from '../assets/useAssetOrPlaceholder'

// Spec 11 task 8.4 (Req 3.3, 3.6, 8.16, 8.22): zombie looks with a missing model file, missing
// look-N meshes and missing clips all fall back without a thrown error.

const INDEXES = [0, 1, 2, 3] as const

beforeEach(() => {
  resetClipWarnings()
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, headers: new Headers() })))
})
afterEach(() => vi.unstubAllGlobals())

describe('zombie looks with art missing', () => {
  it('declares four look meshes for each of the two enemy model files', () => {
    expect(LOOK_MESH_PLACEHOLDERS).toHaveLength(8)
    for (const url of [ZOMBIE_MODEL_URL, BRUTE_MODEL_URL]) {
      const meshes = LOOK_MESH_PLACEHOLDERS.filter((r) => r.path === url).map((r) => r.mesh)
      expect(meshes).toEqual(INDEXES.map(lookMeshName))
    }
  })

  it('shows only the base mesh when the file has no look meshes, for every uid', () => {
    for (let n = 0; n < 40; n++) {
      const names = ['Zombie']
      const visible = visibleMeshNames(names, lookIndex(`z-${n}`))
      expect([...visible]).toEqual(['Zombie'])
    }
  })

  it('shows exactly the chosen look when the file has all four, and the base when one is missing', () => {
    const all = ['look-0', 'look-1', 'look-2', 'look-3']
    for (const i of INDEXES) expect([...visibleMeshNames(all, i)]).toEqual([lookMeshName(i)])
    expect([...visibleMeshNames(['Zombie', 'look-0', 'look-1'], 3)]).toEqual(['Zombie'])
  })

  it('falls back to Idle for a missing clip without throwing', () => {
    const warn = vi.fn()
    expect(() => resolveClip('Lunge', [], ZOMBIE_MODEL_URL, warn)).not.toThrow()
    expect(resolveClip('Lunge', [], ZOMBIE_MODEL_URL, warn)).toBe('Idle')
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('hides every look mesh of a scene graph without touching a missing one', () => {
    const root = new THREE.Group()
    for (const n of ['look-0', 'look-2']) {
      const m = new THREE.Mesh()
      m.name = n
      root.add(m)
    }
    const names: string[] = []
    root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) names.push(o.name)
    })
    const visible = visibleMeshNames(names, 3)
    expect(visible.size).toBe(0)
  })

  it('registers a missing brute file and missing look meshes once each', async () => {
    for (let i = 0; i < 3; i++) await probe(BRUTE_MODEL_URL)
    const key = lookMeshWaitingKey(ZOMBIE_MODEL_URL, 'look-1')
    for (let i = 0; i < 3; i++) registerMissingArt(key)
    const waiting = waitingPaths()
    expect(waiting.filter((p) => p === BRUTE_MODEL_URL)).toHaveLength(1)
    expect(waiting.filter((p) => p === key)).toHaveLength(1)
  })
})
