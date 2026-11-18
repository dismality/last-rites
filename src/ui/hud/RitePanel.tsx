// The rite at the altar (spec 10 task 4.5, Req 17.1-17.7): five places in the order of Crane's
// confession, one select and one button per empty place. Everything works by keyboard (Tab,
// arrow keys on a select, Enter on the button); Esc steps back. Like the answer panel it never
// freezes the night. Reads stores and calls `riteStore.place`; the rules are in systems/rite.ts.
import { InfoDot } from '../theme/InfoDot'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { RELICS, RELIC_MAP, RITE_ORDER, RITE_STEP_LINES } from '../../data/relics'
import { useBossStore } from '../../game/state/bossStore'
import { useInventoryStore } from '../../game/state/inventoryStore'
import { useMysteryStore } from '../../game/state/mysteryStore'
import { holdsRelic, useRiteStore } from '../../game/state/riteStore'
import { useStageStore } from '../../game/state/stageStore'
import { riteBlocked } from '../../game/systems/bossDirector'
import { countRelics } from '../../game/systems/finalRite'
import { placedCount } from '../../game/systems/rite'
import type { RelicId } from '../../game/types'
import { AccusationSection } from './AccusationSection'
import { clock } from './altarPanelView'
import { ALL_PLACED_MESSAGE, CRANE_WAITS_MESSAGE, placeMessage } from './ritePanelView'
import './altarPanel.css'

const FOCUSABLE = 'select, button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'

export function RitePanelBody({ onClose }: { onClose: () => void }) {
  const rite = useRiteStore((s) => s.rite)
  const invRelics = useInventoryStore((s) => s.inventory.relics)
  const mysteryRelics = useMysteryStore((s) => s.mystery.relics)
  const craneAlive = useBossStore((s) => riteBlocked(s.boss))
  const lockedUntil = useStageStore((s) => s.altar.lockedUntil)
  // Quarter-second steps, like the answer panel, so the countdown is live without a render a tick.
  const now = useStageStore((s) => Math.ceil(s.nightElapsed * 4) / 4)
  const solved = useStageStore((s) => s.caseSolved)
  const [result, setResult] = useState('')
  const [choice, setChoice] = useState<Partial<Record<number, RelicId>>>({})
  const root = useRef<HTMLDivElement>(null)

  const held = useMemo(() => countRelics(invRelics, mysteryRelics), [invRelics, mysteryRelics])
  const placedIds = new Set(Object.values(rite.placed))
  const loose = RELICS.filter((r) => holdsRelic(r.id) && !placedIds.has(r.id))
  const lockedFor = Math.max(0, Math.ceil(lockedUntil - now))
  const allPlaced = placedCount(rite) === RITE_ORDER.length

  useEffect(() => {
    root.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
  }, [])

  // The rite is done: the ending takes over, so the panel steps out of the way.
  useEffect(() => {
    if (solved) onClose()
  }, [solved, onClose])

  // Esc closes the panel and goes no further; capture phase so the pause trigger never sees it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const trapTab = (e: ReactKeyboardEvent) => {
    if (e.key !== 'Tab') return
    const items = [...(root.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])]
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  const place = (slot: number) => {
    const relic = choice[slot]
    if (!relic) {
      setResult('Choose a relic for this place first.')
      return
    }
    const out = useRiteStore.getState().place(slot, relic)
    setResult(placeMessage(out, RELIC_MAP[relic].name))
    if (out.kind === 'placed' || out.kind === 'wrong') setChoice((c) => ({ ...c, [slot]: undefined }))
    // A placed relic replaces its select and button with text, which drops keyboard focus to the
    // page. Put it back on the first control left, so Tab and Enter carry on without a mouse.
    if (out.kind === 'placed') {
      requestAnimationFrame(() => root.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus())
    }
  }

  return (
    <div className={`altar-panel ${lockedFor > 0 ? 'altar-panel--locked' : 'altar-panel--ready'}`} onKeyDown={trapTab}>
      <div ref={root} className="altar-panel__sheet" role="dialog" aria-modal="true" aria-labelledby="rite-panel-title">
        <div className="info-row">
        <h2 id="rite-panel-title" className="altar-panel__title">
          The Rite of Rest
        </h2>
        <InfoDot tipKey="hud-relics" label="About relics" />
        </div>
        <p className="altar-panel__case">Lay the relics in the order Crane confessed. Relics held: {held}/5</p>

        <ol className="rite-panel__slots">
          {RITE_ORDER.map((right, slot) => {
            const placed = rite.placed[slot]
            const label = `Place ${slot + 1} of ${RITE_ORDER.length}`
            return (
              <li key={slot} className="rite-panel__slot">
                <span className="rite-panel__label">{label}</span>
                {placed ? (
                  <span className="rite-panel__done">
                    <span aria-hidden="true">✦ </span>
                    {RELIC_MAP[placed].name}. {RITE_STEP_LINES[right]}
                  </span>
                ) : (
                  <>
                    <select
                      className="altar-panel__slot"
                      aria-label={`${label}: choose a relic`}
                      value={choice[slot] ?? ''}
                      onChange={(e) => setChoice((c) => ({ ...c, [slot]: (e.target.value || undefined) as RelicId | undefined }))}
                    >
                      <option value="">(empty)</option>
                      {loose.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="altar-panel__btn" onClick={() => place(slot)}>
                      Lay it here
                    </button>
                  </>
                )}
              </li>
            )
          })}
        </ol>

        {/* The state is words and a mark, never colour alone. */}
        <p className="altar-panel__status" role="status" aria-live="polite">
          <span className="altar-panel__mark" aria-hidden="true">
            {lockedFor > 0 ? '⌛' : allPlaced && craneAlive ? '✝' : '✦'}
          </span>
          {lockedFor > 0
            ? `The altar is silent: ${clock(lockedFor)}`
            : allPlaced
              ? craneAlive
                ? CRANE_WAITS_MESSAGE
                : ALL_PLACED_MESSAGE
              : 'A wrong place sounds a sour note and wakes the dead.'}
        </p>
        <p className="altar-panel__result" role="status" aria-live="assertive">
          {result}
        </p>

        <AccusationSection />

        <div className="altar-panel__actions">
          <button type="button" className="altar-panel__btn altar-panel__btn--quiet" onClick={onClose}>
            Step back (Esc)
          </button>
        </div>
      </div>
    </div>
  )
}
