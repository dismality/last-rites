// Weather: rain as one instanced mesh (one draw call) in a box that follows the camera, plus the
// thunder reaction. Rendering only; rules are in systems/storm.ts and weatherRain.ts.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { setRainFrozen, setRainLevel } from '../../audio/rain'
import { RAIN } from '../../data/storms'
import { subscribeToType } from '../../game/events'
import { isSimFrozen } from '../../game/state/menuState'
import { useSettingsStore } from '../../game/state/settingsStore'
import { stormRuntime } from '../../game/state/stormRuntime'
import { scareRuntime } from '../scares/scareRuntime'
import {
  createRainField,
  stepRain,
  playThunder,
  stepRainLevel,
} from './weatherRain'

const [BOX_X, BOX_Y, BOX_Z] = RAIN.boxM
const SLANT_RAD = (RAIN.slantDeg * Math.PI) / 180
const MAX_DT_S = 0.1
const RAIN_COLOR = '#9fb3c8'

const dummy = new THREE.Object3D()

export function Weather() {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const level = useRef(0)
  const field = useMemo(() => createRainField(Math.random), [])
  const geo = useMemo(() => {
    const g = new THREE.BoxGeometry(RAIN.widthM, RAIN.lengthM, RAIN.widthM)
    g.rotateZ(-SLANT_RAD)
    return g
  }, [])
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: RAIN_COLOR,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        fog: false,
      }),
    [],
  )

  useEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
      setRainLevel(0)
    },
    [geo, mat],
  )

  useEffect(
    () =>
      subscribeToType('thunderRolled', (e) => {
        playThunder(e.close, useSettingsStore.getState(), () => {
          scareRuntime.shakeAge = 0
        })
      }),
    [],
  )

  useFrame((state, rawDelta) => {
    const m = mesh.current
    if (!m) return
    const frozen = isSimFrozen()
    const dt = Math.min(rawDelta, MAX_DT_S)
    setRainFrozen(frozen)
    if (!frozen) {
      level.current = stepRainLevel(level.current, stormRuntime.storm.active, dt)
      setRainLevel(level.current)
    }
    m.visible = level.current > 0
    if (!m.visible) return
    ;(m.material as THREE.MeshBasicMaterial).opacity = RAIN.opacity * level.current
    stepRain(field, dt, frozen)

    const cam = state.camera.position
    for (let i = 0; i < RAIN.count; i++) {
      dummy.position.set(
        cam.x + field.x[i] - BOX_X / 2,
        cam.y + field.y[i] - BOX_Y / 2,
        cam.z + field.z[i] - BOX_Z / 2,
      )
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  })

  return <instancedMesh ref={mesh} args={[geo, mat, RAIN.count]} frustumCulled={false} />
}
