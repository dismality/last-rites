import { describe, it, expect } from 'vitest'
import { DEFAULT_GRAPH, buildGraph, findPath, nearestNode, nextTarget } from './navigation'
import { WAYPOINT_EDGES, WAYPOINT_NODES } from '../../data/waypoints'

describe('waypoint data', () => {
  it('only references existing nodes and is fully connected', () => {
    const ids = new Set(WAYPOINT_NODES.map((n) => n.id))
    for (const [a, b] of WAYPOINT_EDGES) {
      expect(ids.has(a)).toBe(true)
      expect(ids.has(b)).toBe(true)
    }
    for (const id of ids) expect(findPath(DEFAULT_GRAPH, 'hut', id)).not.toBeNull()
  })
})

describe('findPath', () => {
  it('walks the alley from the mouth to the end', () => {
    expect(findPath(DEFAULT_GRAPH, 'row-mouth', 'row-3')).toEqual(['row-mouth', 'row-1', 'row-2', 'row-3'])
  })
  it('returns null for disconnected nodes', () => {
    const g = buildGraph([{ id: 'a', x: 0, z: 0 }, { id: 'b', x: 5, z: 0 }], [])
    expect(findPath(g, 'a', 'b')).toBeNull()
  })
})

describe('nextTarget', () => {
  const goal = { x: -20, z: -57 }
  it('goes straight when nothing blocks', () => {
    expect(nextTarget(DEFAULT_GRAPH, { x: 0, z: 0 }, goal, () => false)).toEqual(goal)
  })
  it('follows waypoints when the direct line is blocked', () => {
    const blockedDirect = (a: { x: number; z: number }, b: { x: number; z: number }) =>
      // only short hops are clear
      Math.hypot(a.x - b.x, a.z - b.z) > 15
    const t = nextTarget(DEFAULT_GRAPH, { x: 0, z: 0 }, goal, blockedDirect)
    expect(t).not.toEqual(goal)
    expect(nearestNode(DEFAULT_GRAPH, t)).toBeTruthy()
  })
})
