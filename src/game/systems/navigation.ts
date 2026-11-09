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
/** A route is kept while the goal stays within this distance of where it was planned for. */
export const ROUTE_GOAL_DRIFT_M = 4
/** Moving at least this much closer to the current waypoint counts as progress. */
export const ROUTE_PROGRESS_M = 0.25
/** No progress for this long means the waypoint is not reachable from here; plan again without it. */
export const ROUTE_STALL_S = 1.5

/**
 * A walker's current route. Kept per zombie so it follows one waypoint at a time: the old stateless
 * version re-picked the nearest visible node every frame, and inside a waypoint's radius it flipped
 * between two targets forever.
 */
export interface RouteState {
  /** Where the route was planned to end. */
  goal: Vec2
  /** Waypoint ids still to visit, in order; `idx` is the one being walked to. */
  ids: readonly string[]
  idx: number
  /** Closest approach to the current target so far, and seconds since it last improved. */
  bestDist: number
  stallS: number
}

export interface Route {
  ids: string[]
  /** Walking length from `from`, through the waypoints, to `goal`. */
  length: number
}

function pathLength(graph: NavGraph, ids: readonly string[]): number {
  let len = 0
  for (let i = 1; i < ids.length; i++) len += dist(graph.nodes.get(ids[i - 1])!, graph.nodes.get(ids[i])!)
  return len
}

/**
 * Cheapest waypoint route from `from` to `goal`. Entry and exit nodes are chosen together by total
 * length (walk to entry + graph path + walk from exit), so a route never starts by heading away
 * from the goal just because the nearest node lies behind the walker.
 */
export function planRoute(
  graph: NavGraph,
  from: Vec2,
  goal: Vec2,
  blocked?: SegmentBlocked,
  banned: readonly string[] = [],
): Route | null {
  const usable = [...graph.nodes].filter(([id]) => !banned.includes(id))
  const seen = (p: Vec2) => {
    const vis = usable.filter(([, pos]) => !blocked || !blocked(p, pos))
    if (vis.length > 0) return vis
    // Nothing in sight: fall back to the closest node so the walker still moves.
    const near = usable.reduce<[string, Vec2] | null>(
      (best, n) => (best === null || dist(p, n[1]) < dist(p, best[1]) ? n : best),
      null,
    )
    return near ? [near] : []
  }
  const entries = seen(from)
  const exits = seen(goal)
  let best: Route | null = null
  for (const [a, pa] of entries) {
    for (const [b, pb] of exits) {
      const ids = findPath(graph, a, b)
      if (!ids) continue
      const length = dist(from, pa) + pathLength(graph, ids) + dist(pb, goal)
      if (!best || length < best.length) best = { ids, length }
    }
  }
  return best
}

export interface Steer {
  target: Vec2
  /** Null when the way is clear and no route is needed. */
  route: RouteState | null
}

/**
 * Where to steer next. With a clear line to the goal go straight. Otherwise follow the stored route
 * one waypoint at a time, advancing only on reaching the waypoint, and plan again only when the goal
 * has moved on, the waypoint is no longer in sight, or the walker has stopped making progress.
 */
export function steer(
  graph: NavGraph,
  from: Vec2,
  goal: Vec2,
  blocked: SegmentBlocked | undefined,
  route: RouteState | null | undefined,
  dt: number,
): Steer {
  if (!blocked || !blocked(from, goal)) return { target: goal, route: null }

  let r: RouteState | null = route ?? null
  let banned: string[] = []
  if (r) {
    const node = r.idx < r.ids.length ? graph.nodes.get(r.ids[r.idx])! : null
    if (dist(r.goal, goal) > ROUTE_GOAL_DRIFT_M) r = null
    else if (node && blocked(from, node)) r = null
    else if (r.stallS >= ROUTE_STALL_S) {
      banned = node ? [r.ids[r.idx]] : []
      r = null
    }
  }
  if (!r) {
    const plan = planRoute(graph, from, goal, blocked, banned)
    if (!plan) return { target: goal, route: null }
    r = { goal, ids: plan.ids, idx: 0, bestDist: Infinity, stallS: 0 }
  }

  // Advance on arrival, or once the next waypoint is already nearer than this one is to it
  // (the corner has been cut). The index only moves forward, so it cannot flip back.
  let idx = r.idx
  let bestDist = r.bestDist
  let stallS = r.stallS
  for (;;) {
    if (idx >= r.ids.length) break
    const here = graph.nodes.get(r.ids[idx])!
    const next = idx + 1 < r.ids.length ? graph.nodes.get(r.ids[idx + 1])! : null
    const arrived = dist(from, here) <= WAYPOINT_REACHED_M
    const cut = next !== null && dist(from, next) < dist(here, next) && !blocked(from, next)
    if (!arrived && !cut) break
    idx++
    bestDist = Infinity
    stallS = 0
  }

  const target = idx < r.ids.length ? graph.nodes.get(r.ids[idx])! : goal
  const d = dist(from, target)
  if (d < bestDist - ROUTE_PROGRESS_M) {
    bestDist = d
    stallS = 0
  } else stallS += dt
  return { target, route: { goal: r.goal, ids: r.ids, idx, bestDist, stallS } }
}

/** Stateless form of `steer`: plans from scratch, so it is only for one-off questions. */
export function nextTarget(
  graph: NavGraph,
  from: Vec2,
  goal: Vec2,
  blocked?: SegmentBlocked,
): Vec2 {
  return steer(graph, from, goal, blocked, null, 0).target
}
