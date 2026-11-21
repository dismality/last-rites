// Ground mist: a few thin sheets of slow-drifting noise just above the turf, the low-lying fog of a
// wet October graveyard. The sheets follow the keeper (the noise is in world space, so the mist
// itself does not slide), never show inside the hut or chapel, thicken at dusk and night, and take
// the sky's fog colour each frame. Rendering only. Low graphics keeps two sheets.
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { CHAPEL, CHAPEL_CENTER, HUT } from '../../data/cemeteryLayout'
import { useWorldStore } from '../../game/state'
import { useSettingsStore } from '../../game/state/settingsStore'
import { playerPositionRef } from './playerPositionRef'

/** Sheet heights (m) and their share of the mist. */
const SHEETS = [
  [0.06, 1.0],
  [0.22, 0.85],
  [0.42, 0.6],
  [0.7, 0.35],
] as const
const SIZE_M = 110
/** Opacity of the thickest sheet, by phase. */
const STRENGTH: Record<string, number> = { day: 0.16, dusk: 0.26, night: 0.3, dawn: 0.22 }

const VERT = /* glsl */ `
varying vec3 vWorld;
#include <fog_pars_vertex>
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`
const FRAG = /* glsl */ `
uniform float uTime;
uniform float uStrength;
uniform float uShare;
uniform vec3 uColor;
uniform vec4 uHut;
uniform vec4 uChapel;
varying vec3 vWorld;
#include <fog_pars_fragment>
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) { s += vnoise(p) * a; p = p * 2.03 + 7.1; a *= 0.5; }
  return s;
}
/** 0 inside a building's footprint (with a soft edge), 1 outside. */
float outside(vec4 r) {
  vec2 d = abs(vWorld.xz - r.xy) - r.zw;
  return smoothstep(0.0, 0.8, max(d.x, d.y));
}
void main() {
  vec2 p = vWorld.xz * 0.07 + vec2(uTime * 0.018, uTime * 0.007);
  float n = fbm(p + fbm(p * 0.5 + uTime * 0.01) * 1.3);
  float m = smoothstep(0.38, 0.85, n);
  // Fade the sheet out near the keeper (no hard edge at the feet) and towards its own rim.
  float dc = distance(vWorld.xz, cameraPosition.xz);
  float a = m * uStrength * uShare * smoothstep(1.2, 5.0, dc) * (1.0 - smoothstep(40.0, 54.0, dc));
  a *= outside(uHut) * outside(uChapel);
  gl_FragColor = vec4(uColor, a);
  #include <fog_fragment>
}
`

export function GroundMist() {
  const low = useSettingsStore((s) => s.lowGraphics)
  const scene = useThree((s) => s.scene)
  const group = useRef<THREE.Group>(null)
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uStrength: { value: STRENGTH.day },
      uColor: { value: new THREE.Color(0.6, 0.64, 0.7) },
      uHut: { value: new THREE.Vector4(0, 0, HUT.halfX + 0.15, HUT.halfZ + 0.15) },
      uChapel: { value: new THREE.Vector4(CHAPEL_CENTER[0], CHAPEL_CENTER[2], CHAPEL.halfX + 0.4, CHAPEL.halfZ + 0.4) },
    }),
    [],
  )
  const sheets = useMemo(() => {
    const geo = new THREE.PlaneGeometry(SIZE_M, SIZE_M, 1, 1).rotateX(-Math.PI / 2)
    const list = (low ? SHEETS.slice(0, 2) : SHEETS).map(([y, share]) => {
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: { ...THREE.UniformsLib.fog, ...uniforms, uShare: { value: share } },
        transparent: true,
        depthWrite: false,
        fog: true,
        side: THREE.DoubleSide,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.y = y
      mesh.renderOrder = 2
      mesh.frustumCulled = false
      mesh.name = 'ground-mist'
      return { mesh, mat }
    })
    return { geo, list }
  }, [low, uniforms])

  // The frame loop reaches the GPU objects through a ref set in the effect, so it never mutates
  // values captured from render.
  const gpu = useRef<{ uniforms: typeof uniforms; sheets: typeof sheets } | null>(null)
  useEffect(() => {
    gpu.current = { uniforms, sheets }
    return () => {
      gpu.current = null
      sheets.geo.dispose()
      for (const s of sheets.list) s.mat.dispose()
    }
  }, [uniforms, sheets])

  const strength = useRef(STRENGTH.day)
  useFrame((_, dt) => {
    const g = gpu.current
    if (!g) return
    const d = Math.min(dt, 0.1)
    const u = g.uniforms
    u.uTime.value += d
    const want = STRENGTH[useWorldStore.getState().phase] ?? STRENGTH.day
    strength.current += (want - strength.current) * Math.min(1, d * 0.3)
    // Lit by the sky: the fog colour, lifted a little so the mist reads against the ground.
    if (scene.fog) u.uColor.value.copy((scene.fog as THREE.FogExp2).color).multiplyScalar(1.25)
    const p = playerPositionRef.current
    group.current?.position.set(Math.round(p.x), 0, Math.round(p.z))
    u.uStrength.value = strength.current
  })

  return (
    <group ref={group} name="ground-mist">
      {sheets.list.map((s) => (
        <primitive key={s.mesh.uuid} object={s.mesh} />
      ))}
    </group>
  )
}
