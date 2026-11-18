// A big, low harvest moon behind the chapel (design bible §15). Two camera-facing discs (the moon
// and its halo) kept at a fixed distance from the camera so it sits at the horizon; the chapel,
// trees and walls in front hide it as they would. Rises at dusk, full at night, gone by day.

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { HARVEST_MOON } from '../../data/allHallows'
import { useWorldStore } from '../../game/state'
import { stormRuntime } from '../../game/state/stormRuntime'
import { easeMoonShow, moonDirection, moonShowTarget } from '../../game/systems/allHallows'

const DIR = moonDirection()

/** The moon's face: warm orange with darker seas and a soft rim. */
function moonTexture(): THREE.CanvasTexture {
  const S = 256
  const c = document.createElement('canvas')
  c.width = c.height = S
  const ctx = c.getContext('2d')
  if (ctx) {
    const r = S / 2
    const body = ctx.createRadialGradient(r * 0.85, r * 0.85, r * 0.1, r, r, r)
    body.addColorStop(0, '#ffe2b0')
    body.addColorStop(0.7, '#f2b36b')
    body.addColorStop(0.97, '#d98a45')
    body.addColorStop(1, 'rgba(217,138,69,0)')
    ctx.fillStyle = body
    ctx.beginPath()
    ctx.arc(r, r, r, 0, Math.PI * 2)
    ctx.fill()
    // Seas.
    ctx.fillStyle = 'rgba(150,80,40,0.28)'
    for (const [x, y, rad] of [
      [0.38, 0.36, 0.17],
      [0.58, 0.3, 0.12],
      [0.62, 0.55, 0.15],
      [0.42, 0.62, 0.1],
      [0.3, 0.52, 0.07],
    ] as const) {
      ctx.beginPath()
      ctx.ellipse(x * S, y * S, rad * S, rad * S * 0.8, 0.4, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function haloTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')
  if (ctx) {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
    g.addColorStop(0, 'rgba(255,255,255,0.9)')
    g.addColorStop(0.35, 'rgba(255,255,255,0.35)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 128)
  }
  return new THREE.CanvasTexture(c)
}

export function HarvestMoon() {
  const group = useRef<THREE.Group>(null)
  const moon = useRef<THREE.Mesh>(null)
  const halo = useRef<THREE.Mesh>(null)
  const show = useRef(moonShowTarget(useWorldStore.getState().phase, false))

  const parts = useMemo(() => {
    const disc = new THREE.PlaneGeometry(HARVEST_MOON.radiusM * 2, HARVEST_MOON.radiusM * 2)
    const moonMat = new THREE.MeshBasicMaterial({
      map: moonTexture(),
      transparent: true,
      fog: false,
      depthWrite: false,
      // Kept out of tone mapping so the moon stays the brightest thing in the night sky.
      toneMapped: false,
    })
    const haloMat = new THREE.MeshBasicMaterial({
      map: haloTexture(),
      color: HARVEST_MOON.haloColor,
      transparent: true,
      fog: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    return { disc, moonMat, haloMat }
  }, [])

  useEffect(
    () => () => {
      parts.disc.dispose()
      parts.moonMat.map?.dispose()
      parts.moonMat.dispose()
      parts.haloMat.map?.dispose()
      parts.haloMat.dispose()
    },
    [parts],
  )

  useFrame((state, delta) => {
    const g = group.current
    if (!g) return
    const target = moonShowTarget(useWorldStore.getState().phase, stormRuntime.storm.active)
    show.current = easeMoonShow(show.current, target, Math.min(delta, 0.1))
    g.visible = show.current > 0.001
    if (!g.visible) return
    if (moon.current) (moon.current.material as THREE.MeshBasicMaterial).opacity = show.current
    if (halo.current) (halo.current.material as THREE.MeshBasicMaterial).opacity = show.current * HARVEST_MOON.haloOpacity
    const cam = state.camera.position
    const d = HARVEST_MOON.distanceM
    g.position.set(cam.x + DIR[0] * d, cam.y + DIR[1] * d, cam.z + DIR[2] * d)
    g.lookAt(cam)
  })

  return (
    <group ref={group} name="harvest-moon">
      <mesh ref={halo} geometry={parts.disc} material={parts.haloMat} scale={HARVEST_MOON.haloScale} renderOrder={-2} />
      <mesh ref={moon} geometry={parts.disc} material={parts.moonMat} renderOrder={-1} />
    </group>
  )
}
