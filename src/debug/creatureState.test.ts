// Spec 11 task 7.6: the Debug_Hook's creatureState() reports what the creature store holds.
import { beforeEach, describe, expect, it } from 'vitest'
import { spawnBrideDev, spawnCrawlerAmbush, spawnHoundPack } from '../dev/devActions'
import { useCreatureStore } from '../game/state/creatureStore'
import { usePlayerStore } from '../game/state/playerStore'
import { resetRun } from '../game/state/resetRun'
import { useWorldStore } from '../game/state/worldStore'
import { api } from './debugHook'

describe('creatureState', () => {
  beforeEach(() => {
    resetRun()
    useCreatureStore.getState().clearNight()
    useWorldStore.setState({ phase: 'night', nightNumber: 2 })
    usePlayerStore.setState({ position: [1000, 0, 1000], yaw: 0 })
  })

  it('is empty on a fresh night', () => {
    const s = api.creatureState()
    expect(s.crawlers).toEqual([])
    expect(s.packs).toEqual([])
    expect(s.bride.alive).toBe(false)
  })

  it('lists the crawler, the bride and the pack the dev buttons add', () => {
    spawnCrawlerAmbush()
    spawnBrideDev()
    spawnHoundPack()
    const s = api.creatureState()
    expect(s.crawlers).toHaveLength(1)
    expect(s.crawlers[0].phase).toBe('hidden')
    expect(s.bride.alive).toBe(true)
    expect(s.packs[0].size).toBe(3)
  })
})
