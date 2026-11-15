// Merchant: Silas Vane's cart (props/merchant-cart.glb, spec 09 task 11n-d) and Silas himself,
// from merged primitives (cloak, face and hat band). Mounted only while he is at the
// gate. The cart's lantern is emissive with no light, so it costs no shadow-casting budget;
// bloom picks it up. Presence changes also raise the arrival and leaving captions.
import { useEffect, useMemo, useState } from 'react'
import { Clone, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { DRACO_PATH, propModelUrl } from '../../data/assets'
import { MERCHANT_SPOT } from '../../data/merchant'
import '../assets/preloadModels'
import {
  isMerchantPresent,
  syncMerchantPresence,
  tryTrade,
} from '../../game/state/merchantPresence'
import { useProgressionStore } from '../../game/state/progressionStore'
import { useWorldStore } from '../../game/state/worldStore'
import { Interactable } from './Interactable'

type Part = [
  geo: THREE.BufferGeometry,
  x: number,
  y: number,
  z: number,
  rotZ?: number,
  rotX?: number,
]

/** Bakes each part's transform in, then merges the lot into one geometry. */
function merge(parts: Part[]): THREE.BufferGeometry {
  const baked = parts.map(([g, x, y, z, rz = 0, rx = 0]) => {
    g.rotateX(rx)
    g.rotateZ(rz)
    g.translate(x, y, z)
    return g
  })
  const merged = mergeGeometries(baked)
  baked.forEach((g) => g.dispose())
  return merged
}

const cyl = (r: number, h: number, seg = 8) => new THREE.CylinderGeometry(r, r, h, seg)

// Silas is built around his own origin, standing on the ground.
const cloak = (): THREE.BufferGeometry =>
  merge([
    [new THREE.CylinderGeometry(0.2, 0.34, 1.3, 8), 0, 0.65, 0],
    [cyl(0.14, 0.2, 8), 0, 1.4, 0],
    [cyl(0.3, 0.04, 10), 0, 1.78, 0],
    [cyl(0.17, 0.3, 8), 0, 1.92, 0],
  ])

const face = (): THREE.BufferGeometry =>
  merge([[new THREE.SphereGeometry(0.14, 8, 6), 0, 1.6, 0.02]])

const CLOAK = '#14110f'
const SKIN = '#a8946a'

function MerchantProps() {
  const cart3d = useGLTF(propModelUrl('merchant-cart'), DRACO_PATH).scene
  const geos = useMemo(() => ({ cloak: cloak(), face: face() }), [])
  useEffect(
    () => () => {
      Object.values(geos).forEach((g) => g.dispose())
    },
    [geos],
  )
  const { cart, silas, yaw } = MERCHANT_SPOT
  return (
    <>
      <group position={[cart[0], cart[1], cart[2]]} rotation={[0, yaw, 0]}>
        {/* merchant-cart.glb faces +Z; its lantern glass is emissive (anchor `lantern`), no light. */}
        <Clone object={cart3d} />
      </group>
      <group position={[silas[0], silas[1], silas[2]]} rotation={[0, yaw, 0]}>
        <Interactable
          kind="merchant"
          id="merchant"
          runeHeight={2.4}
          onInteract={() => {
            tryTrade()
          }}
        >
          <mesh geometry={geos.cloak}>
            <meshStandardMaterial color={CLOAK} roughness={1} />
          </mesh>
          <mesh geometry={geos.face}>
            <meshStandardMaterial color={SKIN} roughness={0.9} />
          </mesh>
        </Interactable>
      </group>
    </>
  )
}

/** Always safe to mount: renders nothing unless Silas is here, and watches for him coming and going. */
export function Merchant() {
  const [present, setPresent] = useState(isMerchantPresent)

  useEffect(() => {
    let was = isMerchantPresent()
    const check = (): void => {
      was = syncMerchantPresence(was)
      setPresent(was)
    }
    const offWorld = useWorldStore.subscribe(check)
    const offStock = useProgressionStore.subscribe(check)
    return () => {
      offWorld()
      offStock()
    }
  }, [])

  return present ? <MerchantProps /> : null
}
