import { useProgressionStore } from '../../game/state/progressionStore'
import { useWorldStore } from '../../game/state/worldStore'
import { dawnCardView } from './dawnView'
import { DawnPicker } from './DawnPicker'

/**
 * Dawn summary with the night score parts. Hosts the upgrade picker, which opens over it when
 * an offer is pending; with no offer the card shows alone for the normal dawn.
 */
export function DawnCard() {
  const phase = useWorldStore((s) => s.phase)
  const summary = useProgressionStore((s) => s.dawnSummary)
  if (phase !== 'dawn') return null

  const view = summary ? dawnCardView(summary) : null
  return (
    <>
      <section className="hud-dawn" aria-label="Dawn summary">
        <h2 className="hud-dawn__title">Dawn</h2>
        {view && (
          <div className="hud-dawn__body">
            <ul className="hud-dawn__list">
              {view.rows.map((r) => (
                <li key={r.label}>
                  {r.label}: {r.value}
                </li>
              ))}
            </ul>
            <ul className="hud-dawn__list" aria-label="Night score">
              {view.scoreParts.map((r) => (
                <li key={r.label}>
                  {r.label}: {r.value}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
      <DawnPicker />
    </>
  )
}
