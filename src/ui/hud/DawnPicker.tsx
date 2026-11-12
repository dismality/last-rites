import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useProgressionStore } from '../../game/state/progressionStore'
import { musicRuntime } from '../../game/state/musicRuntime'
import { simClock } from '../../game/state/simClock'
import { majorScareActive } from '../../game/systems/scareSilence'
import { MenuDialog } from '../menus/MenuDialog'
import { iconUrl } from '../../data/assets'
import { PixelIcon } from '../PixelIcon'
import type { DawnUpgradeId } from '../../game/types'
import { cardIndexForKey, dawnPickerView, nextCardIndex, pickCard } from './dawnView'
import './DawnPicker.css'

const POLL_MS = 200

/** Re-reads the scare schedule, which lives outside React, a few times a second. */
function useMajorScareActive(): boolean {
  const [active, setActive] = useState(() => majorScareActive(musicRuntime.silence, simClock.now))
  useEffect(() => {
    const id = window.setInterval(() => setActive(majorScareActive(musicRuntime.silence, simClock.now)), POLL_MS)
    return () => window.clearInterval(id)
  }, [])
  return active
}

/** 64 px pixel art for the boon; the rune text stands in if the file fails to load. */
function BoonArt({ id, rune }: { id: DawnUpgradeId; rune: string }) {
  const [failed, setFailed] = useState(false)
  return (
    <span className="dawn-picker__art-row" aria-hidden="true">
      {failed ? null : (
        <img
          className="dawn-picker__art"
          src={iconUrl('boon', id)}
          width={64}
          height={64}
          alt=""
          draggable={false}
          onError={() => setFailed(true)}
        />
      )}
      <PixelIcon
        url={iconUrl('boon-rune', id)}
        fallback={rune}
        sizePx={32}
        className={failed ? 'dawn-picker__rune' : 'dawn-picker__rune-img'}
      />
    </span>
  )
}

/** Modal dawn upgrade pick. No onEscape: Esc reaches the pause trigger. */
export function DawnPicker() {
  const ranks = useProgressionStore((s) => s.ranks)
  const pendingPick = useProgressionStore((s) => s.pendingPick)
  const scare = useMajorScareActive()
  const rowRef = useRef<HTMLDivElement>(null)
  const view = dawnPickerView({ ranks, pendingPick, majorScareActive: scare })

  const open = view.open
  const idsKey = view.cards.map((c) => c.id).join(',')

  // Keys 1 to 3 pick a card, so the picker works if the mouse does not. On window, so a click
  // on the backdrop (which drops focus out of the dialog) does not disable them.
  useEffect(() => {
    if (!open) return
    const ids = idsKey.split(',') as DawnUpgradeId[]
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.repeat) return
      const i = cardIndexForKey(e.code, ids.length)
      if (i === null) return
      e.preventDefault()
      pickCard(ids[i])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, idsKey])

  if (!view.open) return null

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const buttons = Array.from(rowRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const next = nextCardIndex(Math.max(at, 0), e.key, buttons.length)
    if (next === null) return
    e.preventDefault()
    buttons[next]?.focus()
  }

  return (
    <MenuDialog titleId="dawn-picker-title" variant="dawn">
      <h2 id="dawn-picker-title" className="menu__title">
        Choose a boon
      </h2>
      <p className="menu__text">The night is over. Take one gift from the dawn.</p>
      <div ref={rowRef} className="dawn-picker__row" role="group" aria-label="Upgrades" onKeyDown={onKeyDown}>
        {view.cards.map((c, i) => (
          <button
            key={c.id}
            type="button"
            className="dawn-picker__card"
            data-boon={c.id}
            aria-keyshortcuts={String(i + 1)}
            onClick={() => pickCard(c.id)}
          >
            <span className="dawn-picker__key" aria-hidden="true">
              {i + 1}
            </span>
            <BoonArt id={c.id} rune={c.rune} />
            <span className="dawn-picker__name">{c.name}</span>
            <span className="dawn-picker__rank">{c.rankText}</span>
            <ul className="dawn-picker__lines">
              {c.lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </button>
        ))}
      </div>
    </MenuDialog>
  )
}
