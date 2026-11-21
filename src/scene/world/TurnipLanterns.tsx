// Carved turnip lanterns with a candle inside (design bible §15): on the hut step and at the foot
// of the readable headstones. Three draw calls in all: the turnips, their stalks and the warm pool
// each candle throws on the ground. No real lights (light budget); the pools carry the glow.

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { TURNIP, TURNIP_LANTERNS } from '../../data/allHallows'
import { useSettingsStore } from '../../game/state/settingsStore'
import { candleFlicker } from '../../game/systems/allHallows'

const COUNT = TURNIP_LANTERNS.length
const BODY_Y = TURNIP.radius * TURNIP.squash * 0.92

/** Draw the turnip's skin and its carved face on a canvas laid around the sphere (u 0.25 faces +Z). */
function turnipTextures(): { map: THREE.CanvasTexture; glow: THREE.CanvasTexture } {
  const W = 256
  const H = 128
  const skin = document.createElement('canvas')
  const lit = document.createElement('canvas')
  skin.width = lit.width = W
  skin.height = lit.height = H
  const s = skin.getContext('2d')
  const g = lit.getContext('2d')
  if (s && g) {
    const grad = s.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, TURNIP.topColor)
    grad.addColorStop(0.16, TURNIP.topColor)
    grad.addColorStop(0.34, TURNIP.fleshColor)
    grad.addColorStop(1, '#b9ad86')
    s.fillStyle = grad
    s.fillRect(0, 0, W, H)
    // Fine streaks so it reads as a root, not a ball.
    s.strokeStyle = 'rgba(70,50,40,0.18)'
    for (let i = 0; i < 40; i++) {
      const x = (i / 40) * W
      s.beginPath()
      s.moveTo(x, 0)
      s.lineTo(x + 6, H)
      s.stroke()
    }
    g.fillStyle = '#000'
    g.fillRect(0, 0, W, H)
    const cx = W * 0.25
    const face = (ctx: CanvasRenderingContext2D) => {
      ctx.beginPath()
      // Slanted eyes.
      ctx.moveTo(cx - 44, 46); ctx.lineTo(cx - 10, 58); ctx.lineTo(cx - 36, 72); ctx.closePath()
      ctx.moveTo(cx + 44, 46); ctx.lineTo(cx + 10, 58); ctx.lineTo(cx + 36, 72); ctx.closePath()
      // A crooked, jagged grin.
      ctx.moveTo(cx - 46, 78)
      ctx.lineTo(cx - 30, 88); ctx.lineTo(cx - 20, 80); ctx.lineTo(cx - 8, 92); ctx.lineTo(cx + 4, 81)
      ctx.lineTo(cx + 16, 92); ctx.lineTo(cx + 28, 82); ctx.lineTo(cx + 48, 76)
      ctx.lineTo(cx + 34, 104); ctx.lineTo(cx - 32, 104)
      ctx.closePath()
      ctx.fill()
    }
    s.fillStyle = '#2a170c'
    face(s)
    g.fillStyle = TURNIP.candleColor
    face(g)
  }
  const map = new THREE.CanvasTexture(skin)
  map.colorSpace = THREE.SRGBColorSpace
  const glow = new THREE.CanvasTexture(lit)
  glow.colorSpace = THREE.SRGBColorSpace
  return { map, glow }
}

/** A soft round pool of candlelight: bright centre fading to nothing. */
function poolTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')
  if (ctx) {
    const r = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    r.addColorStop(0, 'rgba(255,255,255,1)')
    r.addColorStop(0.45, 'rgba(255,255,255,0.45)')
    r.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = r
    ctx.fillRect(0, 0, 64, 64)
  }
  return new THREE.CanvasTexture(c)
}

const dummy = new THREE.Object3D()
const flame = new THREE.Color(TURNIP.candleColor)
const tint = new THREE.Color()

export function TurnipLanterns() {
  const bodies = useRef<THREE.InstancedMesh>(null)
  const stalks = useRef<THREE.InstancedMesh>(null)
  const pools = useRef<THREE.InstancedMesh>(null)
  const calm = !useSettingsStore((s) => s.flashingLights)

  const parts = useMemo(() => {
    const { map, glow } = turnipTextures()
    const body = new THREE.SphereGeometry(TURNIP.radius, 20, 14)
    body.scale(1, TURNIP.squash, 1)
    const bodyMat = new THREE.MeshStandardMaterial({
      map,
      emissiveMap: glow,
      emissive: new THREE.Color('#ffffff'),
      emissiveIntensity: TURNIP.glow,
      roughness: 0.85,
    })
    const stalk = new THREE.CylinderGeometry(0.008, 0.016, 0.07, 6)
    const stalkMat = new THREE.MeshStandardMaterial({ color: '#3d2a1e', roughness: 1 })
    const pool = new THREE.PlaneGeometry(TURNIP.poolRadiusM * 2, TURNIP.poolRadiusM * 2)
    pool.rotateX(-Math.PI / 2)
    const poolMat = new THREE.MeshBasicMaterial({
      map: poolTexture(),
      transparent: true,
      opacity: TURNIP.poolOpacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    })
    return { body, bodyMat, stalk, stalkMat, pool, poolMat, map, glow }
  }, [])

  useEffect(
    () => () => {
      for (const d of [parts.body, parts.bodyMat, parts.stalk, parts.stalkMat, parts.pool, parts.poolMat, parts.map, parts.glow, parts.poolMat.map]) d?.dispose()
    },
    [parts],
  )

  // Place everything once; only the glow changes per frame.
  useEffect(() => {
    const b = bodies.current
    const s = stalks.current
    const p = pools.current
    if (!b || !s || !p) return
    TURNIP_LANTERNS.forEach(({ position: [x, y, z], rotationY }, i) => {
      dummy.position.set(x, y + BODY_Y, z)
      dummy.rotation.set(0, rotationY, 0.06 * Math.sin(i * 2.3))
      dummy.scale.setScalar(0.9 + 0.2 * ((i * 37) % 10) / 10)
      dummy.updateMatrix()
      b.setMatrixAt(i, dummy.matrix)
      dummy.position.set(x, y + BODY_Y * 2 + 0.02, z)
      dummy.updateMatrix()
      s.setMatrixAt(i, dummy.matrix)
      dummy.position.set(x, y + 0.012, z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      p.setMatrixAt(i, dummy.matrix)
      p.setColorAt(i, flame)
    })
    b.instanceMatrix.needsUpdate = true
    s.instanceMatrix.needsUpdate = true
    p.instanceMatrix.needsUpdate = true
    // The culling bounds are computed once, before these matrices were set (every copy at the
    // origin), so the lanterns showed only while the view faced the origin. Recompute them now.
    for (const m of [b, s, p]) m.computeBoundingSphere()
    if (p.instanceColor) p.instanceColor.needsUpdate = true
  }, [])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    // The carved faces share one material, so they breathe together; each pool flickers on its own.
    const b = bodies.current
    const p = pools.current
    if (!b || !p) return
    ;(b.material as THREE.MeshStandardMaterial).emissiveIntensity = TURNIP.glow * candleFlicker(t, 0.3, calm)
    for (let i = 0; i < COUNT; i++) {
      tint.copy(flame).multiplyScalar(candleFlicker(t, i * 1.93 + 0.7, calm))
      p.setColorAt(i, tint)
    }
    if (p.instanceColor) p.instanceColor.needsUpdate = true
  })

  return (
    <group name="turnip-lanterns">
      <instancedMesh ref={bodies} args={[parts.body, parts.bodyMat, COUNT]} receiveShadow />
      <instancedMesh ref={stalks} args={[parts.stalk, parts.stalkMat, COUNT]} />
      <instancedMesh ref={pools} args={[parts.pool, parts.poolMat, COUNT]} renderOrder={1} />
    </group>
  )
}
