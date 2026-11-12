// Merchant: Silas Vane's hearse cart and Silas himself, from merged primitives (5 draw calls:
// cart wood, cart iron, cloak, face and hat band, lantern bulb). Mounted only while he is at the
// gate. The lantern is an emissive sphere with no light, so it costs no shadow-casting budget;
// bloom picks it up. Presence changes also raise the arrival and leaving captions.
import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { MERCHANT_SPOT } from '../../data/merchant'
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

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d)
const cyl = (r: number, h: number, seg = 8) => new THREE.CylinderGeometry(r, r, h, seg)

// Cart faces local +Z; wheels sit on the X sides.
const cartWood = (): THREE.BufferGeometry =>
  merge([
    [box(1.3, 0.12, 2.6), 0, 0.75, 0],
    [box(0.08, 0.7, 2.6), -0.6, 1.15, 0],
    [box(0.08, 0.7, 2.6), 0.6, 1.15, 0],
    [box(1.3, 0.7, 0.08), 0, 1.15, -1.25],
    [box(1.3, 0.12, 2.6), 0, 1.55, -0.1],
    [box(0.06, 0.06, 1.4), -0.35, 0.7, 2.0],
    [box(0.06, 0.06, 1.4), 0.35, 0.7, 2.0],
  ])

const cartIron = (): THREE.BufferGeometry =>
  merge([
    [cyl(0.5, 0.08, 12), -0.75, 0.5, 0.8, Math.PI / 2],
    [cyl(0.5, 0.08, 12), 0.75, 0.5, 0.8, Math.PI / 2],
    [cyl(0.5, 0.08, 12), -0.75, 0.5, -0.8, Math.PI / 2],
    [cyl(0.5, 0.08, 12), 0.75, 0.5, -0.8, Math.PI / 2],
    [cyl(0.03, 0.8, 6), 0.55, 1.95, 1.15],
  ])

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

const bulb = (): THREE.BufferGeometry =>
  merge([[new THREE.SphereGeometry(0.09, 8, 6), 0.55, 1.95, 1.15]])

const WOOD = '#2b211a'
const IRON = '#1c1b1d'
const CLOAK = '#14110f'
const SKIN = '#a8946a'
const EMBER = '#e8913a'

function MerchantProps() {
  const geos = useMemo(
    () => ({ wood: cartWood(), iron: cartIron(), cloak: cloak(), face: face(), bulb: bulb() }),
    [],
  )
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
        <mesh geometry={geos.wood}>
          <meshStandardMaterial color={WOOD} roughness={0.9} />
        </mesh>
        <mesh geometry={geos.iron}>
          <meshStandardMaterial color={IRON} roughness={0.6} metalness={0.4} />
        </mesh>
        <mesh geometry={geos.bulb}>
          <meshStandardMaterial color={EMBER} emissive={EMBER} emissiveIntensity={2} />
        </mesh>
      </group>
      <group position={[silas[0], silas[1], silas[2]]} rotation={[0, yaw, 0]}>
        <Interactable
          kind="merchant"
          id="merchant"
          size={[0.8, 2.1, 0.8]}
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
