// The landmarks and extra marks (hut, merchant, wave graves) a map shows right now. Shared by the
// Journal map and the big map so both always agree.
import { useMemo } from 'react'
import { COMPASS_MARKERS } from '../../data/compass'
import { LANDMARKS, type Landmark } from '../../data/mapLandmarks'
import { MERCHANT_SPOT } from '../../data/merchant'
import { WAVE_GRAVES } from '../../data/waves'
import { useMapStore, useWorldStore } from '../../game/state'
import { useChapelStore } from '../../game/state/chapelStore'
import { isMerchantPresent } from '../../game/state/merchantPresence'
import { discoveredLandmarks } from '../../game/systems/mapReveal'
import { isBellActive } from '../../game/systems/repairs'
import type { ExtraMark } from './mapDraw'

/** The hut sits at the world origin; it shows once its cell is explored (the compass always shows it). */
const HUT_LANDMARK: Landmark = { id: 'hut', kind: 'workbench', name: "Keeper's hut", position: [0, 0, 0] }

export function useMapMarks(): { landmarks: Landmark[]; extraMarks: ExtraMark[] } {
  const map = useMapStore((s) => s.map)
  const phase = useWorldStore((s) => s.phase)
  const bellBuilt = useChapelStore((s) => isBellActive(s.chapel))

  // Locket marker is night-only, like the item itself.
  const landmarks = useMemo(
    () => discoveredLandmarks(map, LANDMARKS).filter((l) => !l.nightOnly || phase === 'night'),
    [map, phase],
  )

  const extraMarks = useMemo<ExtraMark[]>(() => {
    const marks: ExtraMark[] = []
    const hut = discoveredLandmarks(map, [HUT_LANDMARK])
    if (hut.length > 0) marks.push({ id: 'hut', x: 0, z: 0, glyph: COMPASS_MARKERS.hut.glyph })
    if (isMerchantPresent()) {
      marks.push({ id: 'merchant', x: MERCHANT_SPOT.silas[0], z: MERCHANT_SPOT.silas[2], glyph: COMPASS_MARKERS.merchant.glyph })
    }
    if ((phase === 'dusk' || phase === 'night') && bellBuilt) {
      for (const g of WAVE_GRAVES) marks.push({ id: 'graves', x: g.x, z: g.z, glyph: COMPASS_MARKERS.spawn.glyph })
    }
    return marks
    // The map pauses the clock, so presence is read once per open or phase change.
  }, [map, phase, bellBuilt])

  return { landmarks, extraMarks }
}
