import { useMemo } from 'react'
import { readBest } from '../../game/state/endlessBest'
import { useInventoryStore } from '../../game/state/inventoryStore'
import { useMysteryStore } from '../../game/state/mysteryStore'
import { useProgressionStore } from '../../game/state/progressionStore'
import { countRelics } from '../../game/systems/finalRite'
import { statsPanelModel } from './statsPanelModel'
import './menus.css'

interface StatsPanelProps {
  /** Returns to the title. */
  onClose: () => void
}

export function StatsPanel({ onClose }: StatsPanelProps) {
  const stats = useProgressionStore((s) => s.stats)
  const score = useProgressionStore((s) => s.score)
  const mode = useProgressionStore((s) => s.mode)
  const inventoryRelics = useInventoryStore((s) => s.inventory.relics)
  const mystery = useMysteryStore((s) => s.mystery)
  const model = useMemo(
    () =>
      statsPanelModel(stats, score, countRelics(inventoryRelics, mystery.relics), mode, readBest()),
    [stats, score, inventoryRelics, mystery.relics, mode],
  )

  return (
    <section className="stats" aria-label="Run statistics">
      <dl className="ending__stats">
        {model.rows.map((r) => (
          <div key={r.label} className="ending__stat">
            <dt>{r.label}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>
      <div className="menu__actions">
        <button type="button" className="menu__button" onClick={onClose} data-autofocus="">
          Close
        </button>
      </div>
    </section>
  )
}
