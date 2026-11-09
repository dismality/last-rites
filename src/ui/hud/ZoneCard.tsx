import { ZONE_CARDS } from '../../data/zoneCards'
import { useGuidanceStore } from '../../game/state/guidanceStore'
import { cardOpacity } from '../../game/systems/zoneCardTrigger'
import './ZoneCard.css'

function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

/**
 * Zone name card. The live region stays mounted so screen readers pick up the text when it
 * appears; text is rendered only while a card shows, so each showing is announced once.
 * It never emits a subtitle (Req 7.6): the text is already on screen.
 */
export function ZoneCard() {
  const card = useGuidanceStore((s) => s.card)
  const text = card ? ZONE_CARDS[card.zone] : null
  const opacity = card ? cardOpacity(card.elapsed, prefersReducedMotion()) : 0

  return (
    <div className="zone-card" role="status" aria-live="polite" aria-atomic="true" style={{ opacity }}>
      {text && (
        <div key={card?.zone} className="zone-card__panel">
          <p className="zone-card__name">{text.name}</p>
          <p className="zone-card__line">{text.line}</p>
        </div>
      )}
    </div>
  )
}
