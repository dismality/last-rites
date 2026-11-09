// Held meshes for the four Spec 07 weapons, built from primitives only (Req 2.8, 23.8).
//
// Each weapon is merged once into a metal geometry and a wood geometry and
// cached, so a held weapon costs two draw calls (Req 23.8). No model files.
// Local space matches Viewmodel.tsx: the group sits at HELD_POSITION and the
// weapon points down -Z.

import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export type HeldWeaponId = 'revolver' | 'shotgun' | 'wood-axe' | 'silver-sabre'

export const HELD_WEAPON_IDS: readonly HeldWeaponId[] = [
  'revolver',
  'shotgun',
  'wood-axe',
  'silver-sabre',
]

export const isHeldWeaponId = (id: string | null): id is HeldWeaponId =>
  id !== null && (HELD_WEAPON_IDS as readonly string[]).includes(id)

/** Barrel tip in the held group's space, where Viewmodel puts the muzzle quad (task 4.8). */
export const MUZZLE_TIP: Readonly<
  Record<'revolver' | 'shotgun', readonly [number, number, number]>
> = {
  revolver: [0, 0.03, -0.25],
  shotgun: [0, 0.03, -0.46],
}

type Vec3 = [number, number, number]

/** Bakes a transform into the primitive so many can be merged into one geometry. */
function part(
  g: THREE.BufferGeometry,
  pos: Vec3,
  rot: Vec3 = [0, 0, 0],
  scale: Vec3 = [1, 1, 1],
): THREE.BufferGeometry {
  g.applyMatrix4(
    new THREE.Matrix4().compose(
      new THREE.Vector3(...pos),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),
      new THREE.Vector3(...scale),
    ),
  )
  return g
}

/** Cylinders stand along Y; this lays them along the view axis. */
const ALONG_Z: Vec3 = [Math.PI / 2, 0, 0]

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d)
const cyl = (rt: number, rb: number, len: number, seg = 8) =>
  new THREE.CylinderGeometry(rt, rb, len, seg)

interface WeaponGeometry {
  metal: THREE.BufferGeometry
  wood: THREE.BufferGeometry
}

function merge(metal: THREE.BufferGeometry[], wood: THREE.BufferGeometry[]): WeaponGeometry {
  const m = mergeGeometries(metal)
  const w = mergeGeometries(wood)
  // Parts are all indexed with position, normal and uv, so a merge only fails on a coding error.
  if (!m || !w) throw new Error('viewmodelWeapons: geometry merge failed')
  for (const p of [...metal, ...wood]) p.dispose()
  return { metal: m, wood: w }
}

function buildRevolver(): WeaponGeometry {
  return merge(
    [
      part(cyl(0.012, 0.012, 0.22), [0, 0.03, -0.14], ALONG_Z), // barrel
      part(box(0.04, 0.05, 0.12), [0, 0.02, -0.04]), // frame
      part(cyl(0.028, 0.028, 0.05, 10), [0, 0.03, -0.045], ALONG_Z), // drum
      part(box(0.012, 0.025, 0.02), [0, 0.06, 0.03], [0.4, 0, 0]), // hammer
      part(new THREE.TorusGeometry(0.02, 0.003, 4, 8, Math.PI), [0, -0.01, -0.01], [0, 0, Math.PI]), // trigger guard
    ],
    [part(box(0.03, 0.1, 0.045), [0, -0.05, 0.06], [-0.3, 0, 0])], // grip
  )
}

function buildShotgun(): WeaponGeometry {
  return merge(
    [
      part(cyl(0.014, 0.014, 0.45), [-0.015, 0.03, -0.235], ALONG_Z),
      part(cyl(0.014, 0.014, 0.45), [0.015, 0.03, -0.235], ALONG_Z),
      part(box(0.012, 0.02, 0.014), [-0.014, 0.058, -0.0], [0.3, 0, 0]),
      part(box(0.012, 0.02, 0.014), [0.014, 0.058, -0.0], [0.3, 0, 0]),
    ],
    [
      part(box(0.05, 0.035, 0.18), [0, 0.0, -0.2]), // forend
      part(box(0.04, 0.07, 0.3), [0, -0.01, 0.2], [0.12, 0, 0]), // stock
    ],
  )
}

function buildAxe(): WeaponGeometry {
  return merge(
    [
      part(box(0.03, 0.12, 0.1), [0, 0.0, -0.3]), // head
      part(cyl(0.05, 0.05, 0.03, 3), [0, 0.0, -0.37], [Math.PI / 2, 0, Math.PI / 2]), // wedge edge
    ],
    [
      part(cyl(0.016, 0.019, 0.55), [0, 0, -0.02], ALONG_Z), // haft
      part(cyl(0.024, 0.024, 0.14), [0, 0, 0.17], ALONG_Z), // leather-wrapped grip
    ],
  )
}

function buildSabre(): WeaponGeometry {
  return merge(
    [
      part(box(0.014, 0.034, 0.5), [0, 0, -0.33]), // blade
      part(
        new THREE.ConeGeometry(0.02, 0.1, 4),
        [0, 0, -0.63],
        [-Math.PI / 2, Math.PI / 4, 0],
        [0.5, 1, 1],
      ), // tip
      part(new THREE.TorusGeometry(0.04, 0.005, 4, 10), [0, 0, -0.05], [0, 0, 0]), // basket hilt
      part(new THREE.SphereGeometry(0.018, 8, 6), [0, 0, 0.14]), // pommel
    ],
    [part(cyl(0.015, 0.015, 0.16), [0, 0, 0.04], ALONG_Z)], // grip
  )
}

const BUILDERS: Record<HeldWeaponId, () => WeaponGeometry> = {
  revolver: buildRevolver,
  shotgun: buildShotgun,
  'wood-axe': buildAxe,
  'silver-sabre': buildSabre,
}

const geometryCache = new Map<HeldWeaponId, WeaponGeometry>()

/** Built on first use, then shared by every mount. */
export function getWeaponGeometry(id: HeldWeaponId): WeaponGeometry {
  let g = geometryCache.get(id)
  if (!g) {
    g = BUILDERS[id]()
    geometryCache.set(id, g)
  }
  return g
}

interface WeaponMaterials {
  metal: THREE.Material
  wood: THREE.Material
}

const materialCache = new Map<HeldWeaponId, WeaponMaterials>()

export function getWeaponMaterials(id: HeldWeaponId): WeaponMaterials {
  let m = materialCache.get(id)
  if (!m) {
    const silver = id === 'silver-sabre'
    m = {
      metal: new THREE.MeshStandardMaterial({
        color: silver ? '#c9d0d6' : id === 'wood-axe' ? '#7d8288' : '#4a4d52',
        roughness: silver ? 0.3 : 0.5,
        metalness: 0.7,
      }),
      wood: new THREE.MeshStandardMaterial({
        color: id === 'silver-sabre' ? '#3b2a1c' : '#5c3d1e',
        roughness: 0.9,
      }),
    }
    materialCache.set(id, m)
  }
  return m
}
