// Simple, distinct low-poly shapes for material pickups, so a bone, a nail and a vial read
// differently on the ground without any textures. Anything unknown falls back to a small box.

import type { ItemId } from '../../game/types'

const BONE = '#d8d2c0'

function Bone() {
  // A shaft with a knob at each end, lying flat.
  return (
    <group rotation={[0, 0.6, Math.PI / 2]} position={[0, 0.05, 0]}>
      <mesh>
        <cylinderGeometry args={[0.025, 0.025, 0.28, 8]} />
        <meshStandardMaterial color={BONE} roughness={0.9} />
      </mesh>
      {[-0.14, 0.14].map((y) => (
        <group key={y} position={[0, y, 0]}>
          {[-0.02, 0.02].map((x) => (
            <mesh key={x} position={[x, 0, 0]}>
              <sphereGeometry args={[0.032, 8, 6]} />
              <meshStandardMaterial color={BONE} roughness={0.9} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

function IronNails() {
  return (
    <group position={[0, 0.02, 0]}>
      {[0, 1, 2].map((i) => (
        <group
          key={i}
          rotation={[Math.PI / 2, 0, i * 1.1]}
          position={[i * 0.03 - 0.03, 0.01 + i * 0.012, i * 0.02]}
        >
          <mesh>
            <cylinderGeometry args={[0.008, 0.008, 0.16, 6]} />
            <meshStandardMaterial color="#4b4f55" roughness={0.5} metalness={0.7} />
          </mesh>
          <mesh position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.008, 8]} />
            <meshStandardMaterial color="#4b4f55" roughness={0.5} metalness={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function CandleWax() {
  // A pale, slightly slumped lump of wax with a stub of wick.
  return (
    <group>
      <mesh position={[0, 0.05, 0]} scale={[1, 0.8, 1]}>
        <cylinderGeometry args={[0.05, 0.075, 0.1, 10]} />
        <meshStandardMaterial color="#e6dcb8" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.115, 0]}>
        <cylinderGeometry args={[0.005, 0.005, 0.04, 4]} />
        <meshStandardMaterial color="#2a2018" />
      </mesh>
    </group>
  )
}

function HolyWater() {
  // A small stoppered vial; faint glow so it reads as consecrated.
  return (
    <group>
      <mesh position={[0, 0.07, 0]}>
        <cylinderGeometry args={[0.05, 0.055, 0.12, 10]} />
        <meshStandardMaterial
          color="#cfe6d8"
          roughness={0.15}
          transparent
          opacity={0.75}
          emissive="#cfe6d8"
          emissiveIntensity={0.25}
        />
      </mesh>
      <mesh position={[0, 0.16, 0]}>
        <cylinderGeometry args={[0.02, 0.03, 0.06, 8]} />
        <meshStandardMaterial color="#cfe6d8" roughness={0.15} transparent opacity={0.75} />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.022, 0.022, 0.03, 8]} />
        <meshStandardMaterial color="#6b4a2c" roughness={0.9} />
      </mesh>
    </group>
  )
}

function Cloth() {
  // A folded, slumped bundle.
  return (
    <group>
      <mesh position={[0, 0.04, 0]} scale={[1.3, 0.45, 1]}>
        <sphereGeometry args={[0.1, 10, 8]} />
        <meshStandardMaterial color="#9a8f78" roughness={1} />
      </mesh>
      <mesh position={[0.03, 0.075, 0.01]} rotation={[0, 0.5, 0]} scale={[1, 0.3, 0.8]}>
        <boxGeometry args={[0.16, 0.06, 0.1]} />
        <meshStandardMaterial color="#b0a58c" roughness={1} />
      </mesh>
    </group>
  )
}

function LampOil() {
  // A squat dark tin with a spout.
  return (
    <group>
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[0.12, 0.12, 0.08]} />
        <meshStandardMaterial color="#6b4a1f" roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh position={[0.04, 0.15, 0]}>
        <cylinderGeometry args={[0.012, 0.018, 0.07, 6]} />
        <meshStandardMaterial color="#6b4a1f" roughness={0.6} metalness={0.4} />
      </mesh>
    </group>
  )
}

function GraveSalt() {
  // A small white cone of salt.
  return (
    <mesh position={[0, 0.06, 0]}>
      <coneGeometry args={[0.1, 0.12, 8]} />
      <meshStandardMaterial color="#ece8e0" roughness={1} />
    </mesh>
  )
}

function Fallback() {
  return (
    <mesh position={[0, 0.1, 0]}>
      <boxGeometry args={[0.2, 0.2, 0.2]} />
      <meshStandardMaterial color="#d8c9a3" />
    </mesh>
  )
}

export function MaterialShape({ item }: { item: ItemId }) {
  switch (item) {
    case 'bone':
      return <Bone />
    case 'iron-nail':
      return <IronNails />
    case 'candle-wax':
      return <CandleWax />
    case 'holy-water':
      return <HolyWater />
    case 'cloth':
      return <Cloth />
    case 'lamp-oil':
      return <LampOil />
    case 'grave-salt':
      return <GraveSalt />
    default:
      return <Fallback />
  }
}
