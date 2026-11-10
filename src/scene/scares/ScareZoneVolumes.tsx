// Scare trigger volumes: one Rapier sensor box per scare zone. Entering reports the zone id
// to scareRuntime; the stager rolls the director on the next tick. No rules live here.
import { ActiveCollisionTypes } from '@dimforge/rapier3d-compat'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useEffect } from 'react'
import { SCARE_ZONES, type ScareZone } from '../../data/scares'
import { resetScareRuntime, scareRuntime } from './scareRuntime'

function ScareZoneVolume({ zone }: { zone: ScareZone }) {
  const { min, max } = zone.bounds
  const half: [number, number, number] = [
    (max[0] - min[0]) / 2,
    (max[1] - min[1]) / 2,
    (max[2] - min[2]) / 2,
  ]
  const centre: [number, number, number] = [
    (max[0] + min[0]) / 2,
    (max[1] + min[1]) / 2,
    (max[2] + min[2]) / 2,
  ]
  return (
    <RigidBody type="fixed" colliders={false} position={centre}>
      <CuboidCollider
        args={half}
        sensor
        // The player is a kinematic body and sensors are fixed: Rapier skips that pair by default.
        activeCollisionTypes={ActiveCollisionTypes.ALL}
        onIntersectionEnter={() => {
          if (scareRuntime.inside.has(zone.id)) return
          scareRuntime.inside.add(zone.id)
          scareRuntime.entered.add(zone.id)
          scareRuntime.justEntered.push(zone.id)
        }}
        onIntersectionExit={() => scareRuntime.inside.delete(zone.id)}
      />
    </RigidBody>
  )
}

export function ScareZoneVolumes() {
  useEffect(() => {
    resetScareRuntime()
    return resetScareRuntime
  }, [])
  return (
    <>
      {SCARE_ZONES.map((z) => (
        <ScareZoneVolume key={z.id} zone={z} />
      ))}
    </>
  )
}

