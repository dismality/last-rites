import { describe, it, expect } from 'vitest'
import { DEFAULT_GRAPH, buildGraph, findPath, nearestNode, nextTarget, planRoute, steer } from './navigation'
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

describe('steer', () => {
  // A wall across x = 5 with a gap at z in [8, 12]; waypoints sit in the gap's mouths.
  const g = buildGraph(
    [
      { id: 'a', x: 3, z: 10 },
      { id: 'b', x: 7, z: 10 },
    ],
    [['a', 'b']],
  )
  const wall = (p: { x: number; z: number }, q: { x: number; z: number }) => {
    if ((p.x - 5) * (q.x - 5) >= 0) return false
    const z = p.z + ((q.z - p.z) * (5 - p.x)) / (q.x - p.x)
    return z < 8 || z > 12
  }

  it('walks through the gap and never reverses', () => {
    let pos = { x: 0, z: 0 }
    let route = null as ReturnType<typeof steer>['route']
    const goal = { x: 10, z: 0 }
    let reversals = 0
    let last = { x: 0, z: 0 }
    for (let i = 0; i < 4000 && Math.hypot(pos.x - goal.x, pos.z - goal.z) > 1; i++) {
      const s = steer(g, pos, goal, wall, route, 1 / 60)
      route = s.route
      const d = Math.hypot(s.target.x - pos.x, s.target.z - pos.z) || 1
      const step = { x: ((s.target.x - pos.x) / d) * 0.05, z: ((s.target.z - pos.z) / d) * 0.05 }
      if (step.x * last.x + step.z * last.z < 0) reversals++
      last = step
      pos = { x: pos.x + step.x, z: pos.z + step.z }
    }
    expect(Math.hypot(pos.x - goal.x, pos.z - goal.z)).toBeLessThanOrEqual(1)
    expect(reversals).toBe(0)
  })

  it('does not start by walking away from the goal', () => {
    // Standing just beside node b but on the goal's side of the wall: the route must skip b's far side.
    const plan = planRoute(g, { x: 4, z: 1 }, { x: 10, z: 1 }, wall)
    expect(plan?.ids).toEqual(['a', 'b'])
  })
})
