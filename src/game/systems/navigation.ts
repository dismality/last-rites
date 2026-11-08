// Waypoint navigation: shortest path over the hand-placed graph (data/waypoints.ts).
// Pure TS. Line of sight is injected so Rapier raycasts stay in the scene layer.

import type { Vec2 } from './combat'
import { WAYPOINT_EDGES, WAYPOINT_NODES } from '../../data/waypoints'

export interface NavGraph {
  nodes: ReadonlyMap<string, Vec2>
  neighbours: ReadonlyMap<string, readonly string[]>
}

/** True when the straight segment from `a` to `b` is obstructed. */
export type SegmentBlocked = (a: Vec2, b: Vec2) => boolean

const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.z - b.z)

export function buildGraph(
  nodes: ReadonlyArray<{ id: string; x: number; z: number }> = WAYPOINT_NODES,
  edges: ReadonlyArray<readonly [string, string]> = WAYPOINT_EDGES,
): NavGraph {
  const pos = new Map(nodes.map((n) => [n.id, { x: n.x, z: n.z }]))
  const adj = new Map<string, string[]>(nodes.map((n) => [n.id, []]))
  for (const [a, b] of edges) {
    adj.get(a)?.push(b)
    adj.get(b)?.push(a)
  }
  return { nodes: pos, neighbours: adj }
}

export const DEFAULT_GRAPH: NavGraph = buildGraph()

/** A* over node ids; returns the id path inclusive of both ends, or null if unreachable. */
export function findPath(graph: NavGraph, from: string, to: string): string[] | null {
  const start = graph.nodes.get(from)
  const goal = graph.nodes.get(to)
  if (!start || !goal) return null
  const g = new Map<string, number>([[from, 0]])
  const prev = new Map<string, string>()
  const open = new Set<string>([from])
  while (open.size > 0) {
    let cur = ''
    let best = Infinity
    for (const id of open) {
      const f = (g.get(id) ?? Infinity) + dist(graph.nodes.get(id)!, goal)
      if (f < best) {
        best = f
        cur = id
      }
    }
    if (cur === to) {
      const path = [cur]
      while (prev.has(path[0])) path.unshift(prev.get(path[0])!)
      return path
    }
    open.delete(cur)
    for (const n of graph.neighbours.get(cur) ?? []) {
      const cost = (g.get(cur) ?? Infinity) + dist(graph.nodes.get(cur)!, graph.nodes.get(n)!)
      if (cost < (g.get(n) ?? Infinity)) {
        g.set(n, cost)
        prev.set(n, cur)
        open.add(n)
      }
    }
  }
  return null
}

/** Closest node to `p`, preferring ones visible from it; falls back to the closest overall. */
export function nearestNode(graph: NavGraph, p: Vec2, blocked?: SegmentBlocked): string | null {
  let bestVisible: string | null = null
  let bestAny: string | null = null
  let dVisible = Infinity
  let dAny = Infinity
  for (const [id, pos] of graph.nodes) {
    const d = dist(p, pos)
    if (d < dAny) {
      dAny = d
      bestAny = id
    }
    if (d < dVisible && (!blocked || !blocked(p, pos))) {
      dVisible = d
      bestVisible = id
    }
  }
  return bestVisible ?? bestAny
}

/** Reaching a waypoint within this radius counts as arrived. */
export const WAYPOINT_REACHED_M = 1.2

/**
 * Where to steer next. With a clear line to the goal (or no blocker supplied) go straight;
 * otherwise follow the waypoint path, skipping nodes already reached.
 */
export function nextTarget(
  graph: NavGraph,
  from: Vec2,
  goal: Vec2,
  blocked?: SegmentBlocked,
): Vec2 {
  if (!blocked || !blocked(from, goal)) return goal
  const a = nearestNode(graph, from, blocked)
  const b = nearestNode(graph, goal, blocked)
  if (!a || !b) return goal
  const path = findPath(graph, a, b)
  if (!path) return goal
  for (const id of path) {
    const p = graph.nodes.get(id)!
    if (dist(from, p) > WAYPOINT_REACHED_M) return p
  }
  return goal
}
