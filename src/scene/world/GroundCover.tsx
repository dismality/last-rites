// Ground cover: thousands of clumps of long autumn grass over the walled ground, swaying in the
// wind. One clump mesh (curved, tapered blades), instanced per tile so tiles out of view are
// culled; past ~30 m the blades shrink away into the fog. Low graphics halves the density.
// Rendering only: no colliders, nothing to pick.
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSettingsStore } from '../../game/state/settingsStore'
import { clumpTiles } from './groundCoverLayout'

const BLADES = 9
const SEGMENTS = 4
/** Clumps per square metre before paths, floors and stones are cut out. */
const DENSITY = { high: 5, low: 2.4 } as const
const FADE_NEAR_M = 22
const FADE_FAR_M = 32

/** One clump: blades leaning out from the middle, each a tapered strip bent by its own weight. */
function clumpGeometry(): THREE.BufferGeometry {
  const pos: number[] = []
  const col: number[] = []
  const nrm: number[] = []
  const idx: number[] = []
  let seed = 7
  const r = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  for (let b = 0; b < BLADES; b++) {
    const a = (b / BLADES) * Math.PI * 2 + r() * 0.7
    const dirX = Math.cos(a)
    const dirZ = Math.sin(a)
    const h = 0.32 + r() * 0.42
    const w = 0.022 + r() * 0.018
    const lean = 0.12 + r() * 0.3
    const ox = dirX * r() * 0.09
    const oz = dirZ * r() * 0.09
    // The blade's flat side faces sideways to its lean.
    const sx = -dirZ
    const sz = dirX
    const base = pos.length / 3
    for (let i = 0; i <= SEGMENTS; i++) {
      const t = i / SEGMENTS
      const bend = lean * t * t
      const cx = ox + dirX * bend * h
      const cz = oz + dirZ * bend * h
      const y = h * t * (1 - 0.25 * lean * t)
      const half = w * (1 - t) * 0.5 + 0.002
      pos.push(cx - sx * half, y, cz - sz * half, cx + sx * half, y, cz + sz * half)
      // Dark at the root, pale straw at the tip; the tint is per clump (instance colour).
      const shade = 0.35 + 0.65 * t
      col.push(shade, shade, shade, shade, shade, shade)
      // Lit as if facing up: grass reads soft, never as black backs.
      nrm.push(dirX * 0.25, 1, dirZ * 0.25, dirX * 0.25, 1, dirZ * 0.25)
      if (i < SEGMENTS) {
        const k = base + i * 2
        idx.push(k, k + 1, k + 3, k, k + 3, k + 2)
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3))
  g.setIndex(idx)
  g.computeBoundingSphere()
  return g
}

/** Grey-green to dead straw, the October palette. */
const TONES = [new THREE.Color('#4a5230'), new THREE.Color('#6b6a3a'), new THREE.Color('#8a7a4a'), new THREE.Color('#5c4f36')]

function makeMaterial(time: { value: number }): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, side: THREE.DoubleSide })
  m.name = 'ground-cover'
  m.onBeforeCompile = (shader) => {
    shader.uniforms.gcTime = time
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float gcTime;')
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
        {
          vec4 root = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          vec4 wroot = modelMatrix * root;
          float far = smoothstep(${FADE_NEAR_M.toFixed(1)}, ${FADE_FAR_M.toFixed(1)}, distance(wroot.xz, cameraPosition.xz));
          transformed *= 1.0 - far;
          // Wind: a slow gust front across the yard plus a quick flutter, stronger at the tips.
          float tip = clamp(position.y / 0.7, 0.0, 1.0);
          float gust = sin(gcTime * 0.9 + wroot.x * 0.21 + wroot.z * 0.13) * 0.5 + 0.5;
          float flutter = sin(gcTime * 4.3 + wroot.x * 1.7 + wroot.z * 2.3 + position.x * 9.0);
          float sway = tip * tip * (0.08 + 0.12 * gust) + tip * 0.015 * flutter;
          transformed.x += sway;
          transformed.z += sway * 0.45;
        }`,
      )
  }
  return m
}

export function GroundCover() {
  const low = useSettingsStore((s) => s.lowGraphics)
  const time = useMemo(() => ({ value: 0 }), [])
  const geometry = useMemo(() => clumpGeometry(), [])
  const material = useMemo(() => makeMaterial(time), [time])
  const meshes = useMemo(() => {
    const tiles = clumpTiles(low ? DENSITY.low : DENSITY.high)
    const m4 = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    const v = new THREE.Vector3()
    const s = new THREE.Vector3()
    const c = new THREE.Color()
    return tiles.map((clumps) => {
      const inst = new THREE.InstancedMesh(geometry, material, clumps.length)
      clumps.forEach((k, i) => {
        q.setFromAxisAngle(up, k.rot)
        v.set(k.x, 0, k.z)
        s.set(1 + k.scale * 0.3, k.scale, 1 + k.scale * 0.3)
        m4.compose(v, q, s)
        inst.setMatrixAt(i, m4)
        const t = k.tone * (TONES.length - 1)
        const a = Math.floor(t)
        c.copy(TONES[a]).lerp(TONES[Math.min(TONES.length - 1, a + 1)], t - a)
        inst.setColorAt(i, c)
      })
      inst.instanceMatrix.needsUpdate = true
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true
      inst.computeBoundingSphere()
      inst.receiveShadow = true
      inst.castShadow = false
      inst.name = 'ground-cover'
      return inst
    })
  }, [geometry, material, low])

  useEffect(() => () => meshes.forEach((m) => m.dispose()), [meshes])
  // The frame loop reaches the time uniform through a ref set in the effect (never a render value).
  const clock = useRef<{ value: number } | null>(null)
  useEffect(() => {
    clock.current = time
    return () => {
      clock.current = null
    }
  }, [time])
  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )
  useFrame((_, dt) => {
    if (clock.current) clock.current.value += Math.min(dt, 0.1)
  })

  return (
    <group name="ground-cover">
      {meshes.map((m) => (
        <primitive key={m.uuid} object={m} />
      ))}
    </group>
  )
}
