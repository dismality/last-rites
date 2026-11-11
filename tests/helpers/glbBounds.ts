// GLB footprint reader for the structure tests: walks the glTF node tree and transforms each mesh's
// POSITION accessor min/max (exact for the axis-aligned transforms these kit pieces use). Only the
// JSON chunk is read, so Draco-compressed models work and no GPU or decoder is needed.
//
// The file arrives as a `?raw` string (Vite's glob import), which is the project's way of reading
// files in tests: the tests have no Node typings. The JSON chunk is ASCII and starts at byte 20; its
// end is found by brace matching, because the binary chunk behind it does not survive decoding.
import { Matrix4, Quaternion, Vector3 } from 'three'

interface GltfNode {
  mesh?: number
  children?: number[]
  matrix?: number[]
  translation?: number[]
  rotation?: number[]
  scale?: number[]
}
interface Gltf {
  nodes: GltfNode[]
  meshes: Array<{ primitives: Array<{ attributes: { POSITION: number } }> }>
  accessors: Array<{ min?: number[]; max?: number[] }>
  scenes: Array<{ nodes: number[] }>
  scene?: number
}

export interface Bounds {
  min: [number, number, number]
  max: [number, number, number]
}

/** Slices the top-level JSON object that starts at `from`. */
function jsonObjectAt(raw: string, from: number): string {
  let depth = 0
  let inString = false
  for (let i = from; i < raw.length; i++) {
    const ch = raw[i]
    if (inString) {
      if (ch === '\\') i++
      else if (ch === '"') inString = false
    } else if (ch === '"') inString = true
    else if (ch === '{') depth++
    else if (ch === '}' && --depth === 0) return raw.slice(from, i + 1)
  }
  throw new Error('GLB JSON chunk not terminated')
}

function local(n: GltfNode): Matrix4 {
  if (n.matrix) return new Matrix4().fromArray(n.matrix)
  const t = n.translation ?? [0, 0, 0]
  const r = n.rotation ?? [0, 0, 0, 1]
  const s = n.scale ?? [1, 1, 1]
  return new Matrix4().compose(
    new Vector3(...(t as [number, number, number])),
    new Quaternion(...(r as [number, number, number, number])),
    new Vector3(...(s as [number, number, number])),
  )
}

/** Bounds of every mesh in the file, from the raw text of the .glb. */
export function glbBounds(raw: string): Bounds {
  const g = JSON.parse(jsonObjectAt(raw, 20)) as Gltf
  const min = new Vector3(Infinity, Infinity, Infinity)
  const max = new Vector3(-Infinity, -Infinity, -Infinity)
  const visit = (i: number, parent: Matrix4) => {
    const n = g.nodes[i]
    const m = parent.clone().multiply(local(n))
    if (n.mesh !== undefined) {
      for (const p of g.meshes[n.mesh].primitives) {
        const a = g.accessors[p.attributes.POSITION]
        if (!a.min || !a.max) continue
        for (const x of [a.min[0], a.max[0]])
          for (const y of [a.min[1], a.max[1]])
            for (const z of [a.min[2], a.max[2]]) {
              const v = new Vector3(x, y, z).applyMatrix4(m)
              min.min(v)
              max.max(v)
            }
      }
    }
    n.children?.forEach((c) => visit(c, m))
  }
  g.scenes[g.scene ?? 0].nodes.forEach((n) => visit(n, new Matrix4()))
  return { min: [min.x, min.y, min.z], max: [max.x, max.y, max.z] }
}
