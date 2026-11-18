// The belfry flock (spec 11 task 4.4): 15 to 20 bats leave the belfry when the dusk bell rings and
// are gone within 10 s. One InstancedMesh, one draw call. Each bat's path, wing flap and fade are
// computed in the vertex shader from a single time uniform (uTime, seconds since the bell), so the
// CPU only writes one number per frame. Skipped when the 60-frame average frame time is over
// 22 ms. The flock never shakes the camera; the glow is steady with Flashing lights off.
//
// The dusk bell is exposed through `bellRuntime.ringAtMs` (written by `ringBell`, which
// ChapelBuilding calls when the phase turns to dusk and the bell is repaired).

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedMesh,
  ShaderMaterial,
} from 'three'
import { BAT } from '../../data/bats'
import { CHAPEL_ANCHORS } from '../../data/chapelScenery'
import { CHAPEL_CENTER } from '../../data/cemeteryLayout'
import { useSettingsStore } from '../../game/state/settingsStore'
import { useWorldStore } from '../../game/state/worldStore'
import {
  flockActive,
  flockCount,
  flockGlow,
  flockSeeds,
  pushFrame,
  shouldStartFlock,
} from '../../game/systems/belfryFlock'
import { bellRuntime } from './bellRuntime'

const F = BAT.belfryFlock

/** Belfry bell in world space: the chapel's centre plus the model's bell-pivot anchor. */
const ORIGIN = [
  CHAPEL_CENTER[0] + CHAPEL_ANCHORS.bellPivot[0],
  CHAPEL_CENTER[1] + CHAPEL_ANCHORS.bellPivot[1],
  CHAPEL_CENTER[2] + CHAPEL_ANCHORS.bellPivot[2],
] as const

/** A flat bat: a body triangle and two wing triangles. x is the wing axis, -z is forward. */
function batGeometry(): BufferGeometry {
  const h = F.wingspanM / 2
  const verts = new Float32Array([
    // body
    -0.04,
    0,
    0.05,
    0.04,
    0,
    0.05,
    0,
    0,
    -0.1,
    // left wing
    -0.04,
    0,
    0.05,
    -0.04,
    0,
    -0.05,
    -h,
    0,
    0.06,
    // right wing
    0.04,
    0,
    0.05,
    h,
    0,
    0.06,
    0.04,
    0,
    -0.05,
  ])
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(verts, 3))
  return g
}

const VERTEX = /* glsl */ `
  uniform float uTime;
  attribute vec4 aSeed; // angle, speed, flap phase, size
  varying float vWing;
  void main() {
    float flap = sin(uTime * ${(BAT.flapsPerS * Math.PI * 2).toFixed(4)} + aSeed.z);
    vec3 p = position * aSeed.w;
    vWing = abs(position.x) / ${(F.wingspanM / 2).toFixed(4)};
    p.y += flap * abs(position.x) * ${F.flapAmp.toFixed(3)};
    // Face the way the bat flies, then travel outward from the belfry.
    float c = cos(aSeed.x);
    float s = sin(aSeed.x);
    vec3 r = vec3(p.x * c - p.z * s, p.y, p.x * s + p.z * c);
    vec3 dir = vec3(-s, 0.0, -c);
    float fade = 1.0 - smoothstep(${(F.maxS - 1).toFixed(2)}, ${F.maxS.toFixed(2)}, uTime);
    vec3 origin = vec3(${ORIGIN[0].toFixed(3)}, ${ORIGIN[1].toFixed(3)}, ${ORIGIN[2].toFixed(3)});
    vec3 world = origin + dir * (uTime * aSeed.y) + vec3(0.0, uTime * ${F.riseMps.toFixed(2)}, 0.0) + r * fade;
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  }
`

const FRAGMENT = /* glsl */ `
  uniform float uGlow;
  varying float vWing;
  void main() {
    // Near black, with an ember rim at the wing tips that carries the glow.
    vec3 ember = vec3(0.91, 0.57, 0.23) * uGlow * vWing * 0.6;
    gl_FragColor = vec4(vec3(0.04, 0.035, 0.04) + ember, 1.0);
  }
`

export function BelfryFlock() {
  const mesh = useRef<InstancedMesh>(null)
  const geometry = useMemo(() => batGeometry(), [])
  const seedAttr = useMemo(
    () => new InstancedBufferAttribute(new Float32Array(F.capacity * 4), 4),
    [],
  )
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uGlow: { value: F.glowSteady } },
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        side: DoubleSide,
      }),
    [],
  )
  // The frame loop reaches the GPU objects through a ref set in the effect below, so it never
  // mutates values captured from render.
  const gpu = useRef<{ seedAttr: InstancedBufferAttribute; material: ShaderMaterial } | null>(null)
  const run = useRef({ age: -1, lastRing: bellRuntime.ringAtMs, frames: [] as number[] })

  useEffect(() => {
    geometry.setAttribute('aSeed', seedAttr)
    gpu.current = { seedAttr, material }
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material, seedAttr])

  useFrame((_, delta) => {
    const m = mesh.current
    const g = gpu.current
    if (!m || !g) return
    const { seedAttr: seeds2, material: mat } = g
    const r = run.current
    r.frames = pushFrame(r.frames, delta * 1000)

    // A new ring value at dusk is the dusk bell.
    if (bellRuntime.ringAtMs !== r.lastRing) {
      r.lastRing = bellRuntime.ringAtMs
      const phase = useWorldStore.getState().phase
      if (shouldStartFlock({ phase, frames: r.frames, active: flockActive(r.age) })) {
        const seeds = flockSeeds(flockCount(Math.random()), Math.random)
        seeds.forEach((s, i) => seeds2.setXYZW(i, s.angle, s.speed, s.phase, s.size))
        seeds2.needsUpdate = true
        m.count = seeds.length
        r.age = 0
      }
    }

    if (r.age < 0) return
    r.age += delta
    if (!flockActive(r.age)) {
      r.age = -1
      m.visible = false
      return
    }
    m.visible = true
    mat.uniforms.uTime.value = r.age
    mat.uniforms.uGlow.value = flockGlow(r.age, useSettingsStore.getState().flashingLights)
  })

  return (
    <instancedMesh
      ref={mesh}
      name="belfry-flock"
      args={[geometry, material, F.capacity]}
      frustumCulled={false}
      castShadow={false}
      receiveShadow={false}
      visible={false}
      count={0}
    />
  )
}
