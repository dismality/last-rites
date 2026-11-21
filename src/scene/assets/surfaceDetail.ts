// Surface detail for the world's own models (the Blender-built `lr-*` materials). The models carry
// vertex colours and no UVs, so close up a wall or a headstone read as one smooth painted box.
// This patches each material's shader with a world-space triplanar layer: a bump (normal), a tint
// that darkens hollows, and rougher pits, from the code-built textures in surfaceTextures.ts.
// It fades out with distance, so far surfaces never shimmer. Rendering only.
import * as THREE from 'three'
import { SURFACE_KINDS, SURFACE_LOOK, SURFACE_TEX, packSurface, surfaceHeight, type SurfaceKind } from './surfaceTextures'

/** Metres from the camera where the detail starts to fade, and where it is gone. */
export const DETAIL_NEAR_M = 14
export const DETAIL_FAR_M = 38

const textures = new Map<SurfaceKind, THREE.DataTexture>()

function textureFor(kind: SurfaceKind): THREE.DataTexture {
  let t = textures.get(kind)
  if (!t) {
    const data = packSurface(surfaceHeight(kind), SURFACE_TEX, SURFACE_LOOK[kind].bump)
    t = new THREE.DataTexture(data, SURFACE_TEX, SURFACE_TEX, THREE.RGBAFormat)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.magFilter = THREE.LinearFilter
    t.minFilter = THREE.LinearMipmapLinearFilter
    t.generateMipmaps = true
    t.anisotropy = 4
    t.colorSpace = THREE.NoColorSpace
    t.needsUpdate = true
    textures.set(kind, t)
  }
  return t
}

/** The surface kind a material stands for (Blender numbers repeats: lr-stone.003), or null. */
export function surfaceKindOf(name: string): SurfaceKind | null {
  const base = name.replace(/\.\d+$/, '').replace(/^lr-/, '')
  if (!name.startsWith('lr-')) return null
  return (SURFACE_KINDS as readonly string[]).includes(base) ? (base as SurfaceKind) : null
}

const VERT_DECL = /* glsl */ `
varying vec3 vSdPos;
varying vec3 vSdNrm;
`
const VERT_BODY = /* glsl */ `
{
  vec4 sdP = vec4(transformed, 1.0);
  vec3 sdN = objectNormal;
  #ifdef USE_INSTANCING
    sdP = instanceMatrix * sdP;
    sdN = mat3(instanceMatrix) * sdN;
  #endif
  vSdPos = (modelMatrix * sdP).xyz;
  vSdNrm = normalize(mat3(modelMatrix) * sdN);
}
`
const FRAG_DECL = /* glsl */ `
uniform sampler2D sdMap;
uniform float sdScale;
uniform float sdTint;
uniform float sdRough;
uniform float sdBump;
varying vec3 vSdPos;
varying vec3 vSdNrm;
vec4 sdS;
vec3 sdW;
vec4 sdX;
vec4 sdY;
vec4 sdZ;
float sdFade;
`
const FRAG_SAMPLE = /* glsl */ `
{
  vec3 n = normalize(vSdNrm);
  sdW = pow(abs(n), vec3(4.0));
  sdW /= (sdW.x + sdW.y + sdW.z);
  sdX = texture2D(sdMap, vSdPos.zy * sdScale);
  sdY = texture2D(sdMap, vSdPos.xz * sdScale + 0.37);
  sdZ = texture2D(sdMap, vSdPos.xy * sdScale + 0.71);
  sdS = sdX * sdW.x + sdY * sdW.y + sdZ * sdW.z;
  sdFade = 1.0 - smoothstep(${DETAIL_NEAR_M.toFixed(1)}, ${DETAIL_FAR_M.toFixed(1)}, distance(vSdPos, cameraPosition));
  // Hollows darker, ridges a touch lighter; a faint large-scale wash too, so no two walls match.
  diffuseColor.rgb *= 1.0 + (sdS.b - 0.5) * 2.0 * sdTint * (0.35 + 0.65 * sdFade);
}
`
const FRAG_ROUGH = /* glsl */ `
roughnessFactor = clamp(roughnessFactor + (0.5 - sdS.a) * 2.0 * sdRough, 0.04, 1.0);
`
// Triplanar normal by the "whiteout" blend: each projection's slope is added to the geometry
// normal in its own plane, then the three are mixed and taken to view space.
const FRAG_NORMAL = /* glsl */ `
{
  vec3 n = normalize(vSdNrm);
  vec2 tx = (sdX.rg * 2.0 - 1.0) * sdBump;
  vec2 ty = (sdY.rg * 2.0 - 1.0) * sdBump;
  vec2 tz = (sdZ.rg * 2.0 - 1.0) * sdBump;
  vec3 nx = vec3(n.x, n.y + tx.y, n.z + tx.x);
  vec3 ny = vec3(n.x + ty.x, n.y, n.z + ty.y);
  vec3 nz = vec3(n.x + tz.x, n.y + tz.y, n.z);
  vec3 wn = normalize(nx * sdW.x + ny * sdW.y + nz * sdW.z);
  vec3 vn = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
  if (!gl_FrontFacing) vn = -vn;
  normal = normalize(mix(normal, vn, sdFade));
}
`

const patched = new WeakSet<THREE.Material>()

/**
 * The surface of a Kenney world-kit model (one shared palette material, so the kind comes from
 * the model's name), or null for models left as they are.
 */
export function kitSurfaceKind(model: string): SurfaceKind | null {
  if (/^(iron-|fence|lightpost|lantern-)/.test(model)) return 'iron'
  if (/^(cross-wood|coffin|bench|debris-wood|altar-wood)/.test(model)) return 'wood'
  if (/^(trunk|pine)/.test(model)) return 'bark'
  if (/^(grave$|grave-border|road|shovel-dirt)/.test(model)) return 'earth'
  if (/^(gravestone|crypt|pillar|stone-wall|brick-wall|border-pillar|cross|column|altar-stone|urn|rocks|debris)/.test(model))
    return 'stone'
  return null
}

/**
 * Patches one material in place. `kind` overrides the name lookup (for kit models). Returns false
 * when it is not a surface kind or not a standard material.
 */
export function addSurfaceDetailTo(m: THREE.Material, forced?: SurfaceKind | null): boolean {
  if (patched.has(m)) return true
  const kind = forced ?? surfaceKindOf(m.name)
  const std = m as THREE.MeshStandardMaterial
  if (!kind || !std.isMeshStandardMaterial) return false
  const look = SURFACE_LOOK[kind]
  const map = textureFor(kind)
  const prev = std.onBeforeCompile
  std.onBeforeCompile = (shader, renderer) => {
    prev?.call(std, shader, renderer)
    shader.uniforms.sdMap = { value: map }
    shader.uniforms.sdScale = { value: 1 / look.metres }
    shader.uniforms.sdTint = { value: look.tint }
    shader.uniforms.sdRough = { value: look.rough }
    shader.uniforms.sdBump = { value: 1 }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_DECL}`)
      .replace('#include <project_vertex>', `#include <project_vertex>\n${VERT_BODY}`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_DECL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${FRAG_SAMPLE}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${FRAG_ROUGH}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${FRAG_NORMAL}`)
  }
  const prevKey = std.customProgramCacheKey?.bind(std)
  std.customProgramCacheKey = () => `${prevKey ? prevKey() : ''}|sd-${kind}`
  std.needsUpdate = true
  patched.add(std)
  return true
}

/** Patches every surface material under a loaded model (shared materials are patched once). */
export function addSurfaceDetail(root: THREE.Object3D, forced?: SurfaceKind | null): number {
  let n = 0
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) if (addSurfaceDetailTo(m, forced)) n++
  })
  return n
}
