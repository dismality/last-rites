import { FIREARM_MAP } from '../../data/firearms'
import { useCombatStore } from '../../game/state/combatStore'
import { useInventoryStore } from '../../game/state/inventoryStore'
import { ammoReadout, quantiseReloadSeconds } from '../../game/systems/ammoReadout'
import { countItem } from '../../game/systems/inventory'
import type { FirearmId } from '../../game/types'
import './AmmoReadout.css'

const isFirearm = (id: string | null): id is FirearmId => id === 'revolver' || id === 'shotgun'

/** Ammo count "M / S" with a distinct glyph per state (design bible §4, never colour alone). */
export function AmmoReadout() {
  const held = useCombatStore((s) => s.live.heldId)
  const weapon = isFirearm(held) ? held : null
  const magazine = useCombatStore((s) => (weapon ? (s.firearms[weapon]?.magazine ?? 0) : 0))
  // Quantised to 0.1 s inside the selector so the HUD re-renders at most 10 times a second.
  const reloadS = useCombatStore((s) =>
    weapon && s.live.reload && s.live.reload.weapon === weapon
      ? quantiseReloadSeconds(s.live.reload.leftS)
      : null,
  )
  const stack = useInventoryStore((s) =>
    weapon ? countItem(s.inventory, FIREARM_MAP[weapon].ammo) : 0,
  )

  const view = ammoReadout({
    firearmEquipped: weapon !== null,
    magazine,
    stack,
    reloadSecondsLeft: reloadS,
  })
  if (!view) return null

  return (
    <div className="ammo-readout" role="status" aria-label={`Ammunition ${view.count}`}>
      <span className="ammo-readout__count">{view.count}</span>
      {view.labels.map((l) => (
        <span key={l.id} className="ammo-readout__label" data-state={l.id}>
          <span aria-hidden="true" className="ammo-readout__glyph">
            {l.glyph}
          </span>{' '}
          {l.text}
        </span>
      ))}
    </div>
  )
}
