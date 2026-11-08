import { useEndingStore } from '../../game/state/endingStore'
import { useInventoryStore } from '../../game/state/inventoryStore'
import { useMysteryStore } from '../../game/state/mysteryStore'
import { useWorldStore } from '../../game/state/worldStore'
import { countRelics, riteAvailability } from '../../game/systems/finalRite'
import { RITE_DURATION } from '../../game/systems/mystery'

/** Night-5 rite prompt and progress. The ink bar always carries a text readout too. */
export function RiteMeter() {
  const nightNumber = useWorldStore((s) => s.nightNumber)
  const phase = useWorldStore((s) => s.phase)
  const cleared = useEndingStore((s) => s.nightFiveCleared)
  const relics = useInventoryStore((s) => s.inventory.relics)
  const mystery = useMysteryStore((s) => s.mystery)

  const relicCount = countRelics(relics, mystery.relics)
  const availability = riteAvailability({ nightNumber, phase, wavesCleared: cleared, relicCount })
  if (availability !== 'ready') return null

  const done = Math.min(mystery.riteProgress, RITE_DURATION)
  const pct = Math.round((done / RITE_DURATION) * 100)
  return (
    <div className="hud-rite">
      <p className="hud-rite__prompt">Hold E at the altar to finish the rite</p>
      <div
        className="hud-rite__bar"
        role="progressbar"
        aria-label="Rite progress"
        aria-valuemin={0}
        aria-valuemax={RITE_DURATION}
        aria-valuenow={Math.floor(done)}
      >
        <div className="hud-rite__fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="hud-rite__time">
        {Math.floor(done)} / {RITE_DURATION} s
      </p>
    </div>
  )
}
