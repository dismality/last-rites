// Hand-placed waypoint graph for zombie navigation (combat-waves design: Navigation).
// Coordinates follow cemeteryLayout.ts (+X east, +Z south). Nodes sit on the corridor
// centrelines and at the mouths so zombies can follow the alleys without a navmesh.
// Pure data: no logic.

export interface WaypointNode {
  readonly id: string
  readonly x: number
  readonly z: number
}

export const WAYPOINT_NODES: readonly WaypointNode[] = [
  // Grounds hub
  { id: 'hut', x: 0, z: 0 },
  { id: 'grounds-west', x: -20, z: -10 },
  { id: 'grounds-east', x: 25, z: 0 },
  { id: 'grounds-south', x: 10, z: 25 },
  // Chapel door (door is in the -Z face, centred on the chapel's x)
  { id: 'chapel-door', x: 10, z: -3 },
  // Mausoleum Row (x = -20, runs toward -Z)
  { id: 'row-mouth', x: -20, z: -37 },
  { id: 'row-1', x: -20, z: -45 },
  { id: 'row-2', x: -20, z: -52 },
  { id: 'row-3', x: -20, z: -58 },
  // Catacombs (x = 25, runs toward +Z)
  { id: 'cat-mouth', x: 25, z: 37 },
  { id: 'cat-1', x: 25, z: 45 },
  { id: 'cat-2', x: 25, z: 52 },
  { id: 'cat-3', x: 25, z: 58 },
]

export const WAYPOINT_EDGES: ReadonlyArray<readonly [string, string]> = [
  ['hut', 'grounds-west'],
  ['hut', 'grounds-east'],
  ['hut', 'chapel-door'],
  ['grounds-east', 'chapel-door'],
  ['grounds-east', 'grounds-south'],
  ['grounds-west', 'row-mouth'],
  ['row-mouth', 'row-1'],
  ['row-1', 'row-2'],
  ['row-2', 'row-3'],
  ['grounds-south', 'cat-mouth'],
  ['cat-mouth', 'cat-1'],
  ['cat-1', 'cat-2'],
  ['cat-2', 'cat-3'],
]
