// The altar answer panel (spec 10 task 2.5, Req 3): opened with E at the chapel altar. It shows
// the case's Final_Question with the blanks already filled on the board (editable here), and an
// Answer button that calls `caseStore.giveAnswer`. It never freezes the world: at night the dead
// keep coming while the player answers. It owns Esc (closes) like the workbench does.
// Reads stores and calls actions only; the rules are in the systems and `altarPanelView`.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { caseOfStage } from '../../data/cases'
import { useCaseStore } from '../../game/state/caseStore'
import { useGameStore } from '../../game/state/gameStore'
import { useOverlayStore } from '../../game/state/overlayStore'
import { useStageStore } from '../../game/state/stageStore'
import { useWorldStore } from '../../game/state/worldStore'
import { correctLinkCount } from '../../game/systems/caseBoard'
import { questionSegments } from '../journal/caseBoardView'
import { altarStatus, verdictMessage } from './altarPanelView'
import './altarPanel.css'

const FOCUSABLE = 'select, button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'

function AltarPanelBody({ onClose }: { onClose: () => void }) {
  const stage = useStageStore((s) => s.stage)
  const def = caseOfStage(stage)
  const progress = useCaseStore((s) => s.cases[def.id])
  const altar = useStageStore((s) => s.altar)
  // Quarter-second steps keep the countdown live without a render on every fixed step.
  const now = useStageStore((s) => Math.round(s.nightElapsed * 4) / 4)
  const solved = useStageStore((s) => s.caseSolved)
  const phase = useWorldStore((s) => s.phase)
  const [result, setResult] = useState('')
  const root = useRef<HTMLDivElement>(null)

  const links = useMemo(() => correctLinkCount({ links: progress.links }, def), [progress.links, def])
  const status = altarStatus(altar, now, phase, links)

  // Focus the first blank so the keyboard works at once.
  useEffect(() => {
    root.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
  }, [])

  // The case is solved: the sequence takes over, so the panel steps out of the way.
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

  const answer = () => {
    const verdict = useCaseStore.getState().giveAnswer()
    setResult(verdictMessage(verdict) ?? '')
  }

  return (
    <div className={`altar-panel altar-panel--${status.kind}`} onKeyDown={trapTab}>
      <div
        ref={root}
        className="altar-panel__sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="altar-panel-title"
      >
        <h2 id="altar-panel-title" className="altar-panel__title">
          The Altar
        </h2>
        <p className="altar-panel__case">{def.title}</p>

        <p className="altar-panel__sentence">
          {questionSegments(def.final).map((seg, i) => {
            if (seg.kind === 'text') return <span key={i}>{seg.text}</span>
            const slot = seg.slot ?? 0
            const slotDef = def.final.slots[slot]
            return (
              <select
                key={i}
                className="altar-panel__slot"
                aria-label={`${slotDef.label}, blank ${slot + 1} of ${def.final.slots.length}`}
                value={progress.slots[slot] ?? ''}
                onChange={(e) => useCaseStore.getState().fillSlot(slot, e.target.value || null)}
              >
                <option value="">(empty)</option>
                {slotDef.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            )
          })}
        </p>

        {/* The state is words and a mark, never colour alone. */}
        <p className="altar-panel__status" role="status" aria-live="polite">
          <span className="altar-panel__mark" aria-hidden="true">
            {status.kind === 'ready' ? '✦' : status.kind === 'locked' ? '⌛' : '✕'}
          </span>
          {status.text}
        </p>
        <p className="altar-panel__result" role="status" aria-live="assertive">
          {result}
        </p>
        <p className="altar-panel__count">Wrong answers on this case: {altar.wrong}</p>

        <div className="altar-panel__actions">
          <button type="button" className="altar-panel__btn" onClick={answer}>
            Answer
          </button>
          <button type="button" className="altar-panel__btn altar-panel__btn--quiet" onClick={onClose}>
            Step back (Esc)
          </button>
        </div>
      </div>
    </div>
  )
}

/** Mount once. Renders while the altar panel is open on the game screen. */
export function AltarPanel() {
  const open = useOverlayStore((s) => s.altarPanelOpen)
  const screen = useGameStore((s) => s.screen)
  const taken = useGameStore((s) => s.taken)
  const close = useMemo(() => () => useOverlayStore.getState().setAltarPanelOpen(false), [])

  // Leaving the game or being taken closes it, so no stale flag holds the cursor.
  useEffect(() => {
    if (open && (screen !== 'game' || taken)) close()
  }, [open, screen, taken, close])

  if (!open || screen !== 'game' || taken) return null
  return <AltarPanelBody onClose={close} />
}
