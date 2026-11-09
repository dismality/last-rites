// Floating damage numbers: one InstancedMesh of glyph quads cut from a canvas atlas, billboarded
// on the CPU. Body hits are parchment; headshots are ember and end in "!" (a shape cue, Req 10.6).
import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { DAMAGE_NUMBER } from '../../data/combatFeedback'
import { numberText } from '../../game/systems/damageNumbers'
import { useFeedbackStore } from '../../game/state/feedbackStore'
import { GLYPHS, glyphIndex, makeAtlasCanvas } from './damageNumberAtlas'

const GLYPH_W = 0.16
const GLYPH_H = 0.24
const ADVANCE = 0.14
/** Up to 6 glyphs per number bounds the pool. */
const POOL = DAMAGE_NUMBER.max * 6

const PARCHMENT = new THREE.Color('#d8c9a3')
const EMBER = new THREE.Color('#e8913a')

const _m = new THREE.Matrix4()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3(GLYPH_W, GLYPH_H, 1)
const _right = new THREE.Vector3()

const VERT = /* glsl */ `
  attribute vec2 glyphAlpha;
  varying vec2 vUv;
  varying float vAlpha;
  varying vec3 vTint;
  uniform float cells;
  void main() {
    vUv = vec2((uv.x + glyphAlpha.x) / cells, uv.y);
    vAlpha = glyphAlpha.y;
    #ifdef USE_INSTANCING_COLOR
      vTint = instanceColor;
    #else
      vTint = vec3(1.0);
    #endif
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`
const FRAG = /* glsl */ `
  uniform sampler2D map;
  varying vec2 vUv;
  varying float vAlpha;
  varying vec3 vTint;
  void main() {
    vec4 t = texture2D(map, vUv);
    gl_FragColor = vec4(vTint, t.a * vAlpha);
    if (gl_FragColor.a < 0.02) discard;
  }
`

export function DamageNumbers() {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const geo = useRef<THREE.PlaneGeometry>(null)
  const mat = useRef<THREE.ShaderMaterial>(null)
  const attr = useRef<THREE.InstancedBufferAttribute | null>(null)

  useEffect(() => {
    const canvas = makeAtlasCanvas()
    const tex = canvas ? new THREE.CanvasTexture(canvas) : null
    if (tex) tex.colorSpace = THREE.SRGBColorSpace
    const material = mat.current
    const geometry = geo.current
    if (material) {
      material.uniforms.map.value = tex
      material.uniforms.cells.value = GLYPHS.length
    }
    const a = new THREE.InstancedBufferAttribute(new Float32Array(POOL * 2), 2)
    attr.current = a
    geometry?.setAttribute('glyphAlpha', a)
    return () => {
      tex?.dispose()
    }
  }, [])

  useFrame(({ camera }) => {
    const im = mesh.current
    const a = attr.current
    if (!im || !a) return
    _right.set(1, 0, 0).applyQuaternion(camera.quaternion)
    let n = 0
    for (const d of useFeedbackStore.getState().numbers) {
      const text = numberText(d)
      const color = d.headshot ? EMBER : PARCHMENT
      const alpha = 1 - Math.min(1, d.ageS / DAMAGE_NUMBER.lifeS) ** 2
      const start = -((text.length - 1) * ADVANCE) / 2
      for (let i = 0; i < text.length && n < POOL; i++) {
        const g = glyphIndex(text[i])
        if (g < 0) continue
        const off = start + i * ADVANCE
        _p.set(d.x + _right.x * off, d.y + _right.y * off, d.z + _right.z * off)
        _m.compose(_p, camera.quaternion, _s)
        im.setMatrixAt(n, _m)
        im.setColorAt(n, color)
        a.setXY(n, g, alpha)
        n++
      }
    }
    im.count = n
    im.instanceMatrix.needsUpdate = true
    if (im.instanceColor) im.instanceColor.needsUpdate = true
    a.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, POOL]}
      frustumCulled={false}
      renderOrder={20}
    >
      <planeGeometry ref={geo} args={[1, 1]} />
      <shaderMaterial
        ref={mat}
        uniforms={{ map: { value: null }, cells: { value: GLYPHS.length } }}
        vertexShader={VERT}
        fragmentShader={FRAG}
        transparent
        depthWrite={false}
        depthTest={false}
      />
    </instancedMesh>
  )
}
