// Checks delivered enemy .glb files against spec 11 Requirement 3.8: one skinned mesh (one skin
// shared by every look-N variant) and fewer than 15,000 triangles drawn at once (the base meshes
// plus the largest look-N mesh). Files that are not there yet are skipped.
//
// Usage: node scripts/checkEnemyModels.mjs [directory]   (default: public/assets/models/enemies)
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const MAX_TRIANGLES = 15000
export const ENEMY_FILES = ['zombie.glb', 'zombie-brute.glb', 'crawler.glb', 'bride.glb', 'hound.glb']

const GLB_MAGIC = 0x46546c67 // "glTF"
const JSON_CHUNK = 0x4e4f534a // "JSON"

/** Reads the JSON chunk of a GLB buffer. Throws on anything that is not a GLB. */
export function readGlbJson(buf) {
  if (buf.length < 20 || buf.readUInt32LE(0) !== GLB_MAGIC) throw new Error('not a GLB file')
  const length = buf.readUInt32LE(12)
  if (buf.readUInt32LE(16) !== JSON_CHUNK) throw new Error('first chunk is not JSON')
  return JSON.parse(buf.toString('utf8', 20, 20 + length))
}

function primitiveTriangles(gltf, prim) {
  const mode = prim.mode ?? 4
  const count = prim.indices !== undefined
    ? gltf.accessors[prim.indices].count
    : gltf.accessors[prim.attributes.POSITION].count
  if (mode === 4) return Math.floor(count / 3)
  if (mode === 5 || mode === 6) return Math.max(0, count - 2)
  return 0
}

/** Returns { skins, triangles, problems } for a parsed glTF JSON. */
export function inspectGltf(gltf) {
  const skins = (gltf.skins ?? []).length
  const meshTris = (gltf.meshes ?? []).map((m) =>
    (m.primitives ?? []).reduce((n, p) => n + primitiveTriangles(gltf, p), 0),
  )
  let base = 0
  let largestLook = 0
  for (const node of gltf.nodes ?? []) {
    if (node.mesh === undefined) continue
    const tris = meshTris[node.mesh]
    if (typeof node.name === 'string' && node.name.startsWith('look-')) {
      largestLook = Math.max(largestLook, tris)
    } else {
      base += tris
    }
  }
  const triangles = base + largestLook
  const problems = []
  if (skins !== 1) problems.push(`expected 1 skinned mesh (one skin), found ${skins}`)
  if (triangles >= MAX_TRIANGLES) problems.push(`${triangles} triangles, limit is under ${MAX_TRIANGLES}`)
  return { skins, triangles, problems }
}

/** Checks every known enemy file under `dir`; returns { checked, skipped, failures }. */
export function checkDirectory(dir, log = console.log) {
  const result = { checked: [], skipped: [], failures: [] }
  for (const name of ENEMY_FILES) {
    const path = join(dir, name)
    if (!existsSync(path)) {
      result.skipped.push(name)
      log(`skip  ${name} (not delivered yet)`)
      continue
    }
    try {
      const { triangles, problems } = inspectGltf(readGlbJson(readFileSync(path)))
      result.checked.push(name)
      if (problems.length === 0) log(`ok    ${name} (${triangles} triangles)`)
      for (const p of problems) {
        result.failures.push(`${name}: ${p}`)
        log(`FAIL  ${name}: ${p}`)
      }
    } catch (err) {
      result.failures.push(`${name}: ${err.message}`)
      log(`FAIL  ${name}: ${err.message}`)
    }
  }
  return result
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2] ?? 'public/assets/models/enemies'
  const { failures } = checkDirectory(dir)
  process.exit(failures.length === 0 ? 0 : 1)
}
