// CoinPiles: every Grave Coin heap on the ground as one instanced mesh (one draw call, max 32).
// Heaps are a few stacked low-poly coins merged into a single geometry, in a shared ember
// material that glows a little so they read in the dark. Rendering only; the data is in coinStore.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { COIN_PILE } from '../../data/graveCoins'
import { useCoinStore } from '../../game/state/coinStore'
import { isSimFrozen } from '../../game/state/menuState'
import { pileInstances } from './coinPileLayout'

const EMBER = '#e8913a'
const COIN_RADIUS = 0.07
const COIN_THICKNESS = 0.014
const BOB_M = 0.012
const BOB_HZ = 1.2

/** Five flat coins, some tilted, so the heap has a lumpy silhouette. */
function heapGeometry(): THREE.BufferGeometry {
  const layout: [number, number, number, number, number][] = [
    // x, y, z, tiltX, tiltZ
    [0, 0.007, 0, 0, 0],
    [0.09, 0.007, 0.03, 0, 0.1],
    [-0.07, 0.007, -0.05, 0.1, 0],
    [0.02, 0.021, 0.01, 0.05, -0.08],
    [0.05, 0.03, -0.03, -0.3, 0.2],
  ]
  const parts = layout.map(([x, y, z, rx, rz]) => {
    const c = new THREE.CylinderGeometry(COIN_RADIUS, COIN_RADIUS, COIN_THICKNESS, 8)
    c.rotateX(rx)
    c.rotateZ(rz)
    c.translate(x, y, z)
    return c
  })
  const merged = mergeGeometries(parts)
  parts.forEach((p) => p.dispose())
  return merged
}

const dummy = new THREE.Object3D()

export function CoinPiles() {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const geo = useMemo(() => heapGeometry(), [])
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: EMBER,
        emissive: EMBER,
        emissiveIntensity: 0.35,
        metalness: 0.6,
        roughness: 0.4,
      }),
    [],
  )

  useEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
    },
    [geo, mat],
  )

  useFrame((state) => {
    // Pile ages only advance in the sim tick, so a frozen world needs no update at all.
    if (isSimFrozen()) return
    const m = mesh.current
    if (!m) return
    const t = state.clock.elapsedTime
    const list = pileInstances(useCoinStore.getState().piles)
    list.forEach((p, i) => {
      dummy.position.set(p.x, Math.sin(t * Math.PI * 2 * BOB_HZ + i) * BOB_M + BOB_M, p.z)
      dummy.rotation.set(0, p.yaw, 0)
      dummy.scale.setScalar(p.scale)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    })
    m.count = list.length
    m.instanceMatrix.needsUpdate = true
  })

  return <instancedMesh ref={mesh} args={[geo, mat, COIN_PILE.maxPiles]} frustumCulled={false} />
}
