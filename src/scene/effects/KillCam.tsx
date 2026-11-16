// Grab kill-cam driver (spec 10 task 8, Req 25): releases the held keeper when the hold is over.
// The camera pose is applied by FirstPersonController; the edge is the HUD's GrabEdge. Nothing drawn
// here: the zombie's silhouette, the stinger and the dust are the whole scare (Req 25.8).

import { useFrame } from '@react-three/fiber'
import { tickKillCam } from '../../game/state/killCamActions'
import { isSimFrozen } from '../../game/state/menuState'

export function KillCam() {
  useFrame(() => {
    if (isSimFrozen()) return
    tickKillCam()
  })
  return null
}
