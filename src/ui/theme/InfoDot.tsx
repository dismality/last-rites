// Info dot (spec 11 H5): a small "i" button whose parchment tooltip says how to play. Opens at
// once on hover, focus or tap (well inside the 100 ms budget); closes on leave, blur, an outside
// tap or Esc (infoDotState). Renders nothing while "Show info dots" is off, so it is out of the
// DOM and the Tab order. The tooltip is portalled to <body>: a transformed ancestor (the stamina bar)
// would otherwise make its position:fixed relative to that ancestor and push it off screen.
import { createPortal } from 'react-dom'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { INFO_TIPS, type InfoTipKey } from '../../data/infoTips'
import { useSettingsStore } from '../../game/state/settingsStore'
import { placeTooltip, tipFor, type Rect } from '../../game/systems/infoTips'
import { registerOpenTip } from './infoDotState'
import './InfoDot.css'

/** HUD blocks a tooltip must stay clear of: health bar, oil gauge and hint panel share this column. */
const AVOID_SELECTOR = '.hud-corner > *'

function toRect(r: DOMRect): Rect {
  return { x: r.left, y: r.top, width: r.width, height: r.height }
}

export function InfoDot({ tipKey, label }: { tipKey: InfoTipKey; label?: string }) {
  const show = useSettingsStore((s) => s.showInfoDots)
  const text = tipFor(tipKey, show)
  const id = useId()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const unregister = registerOpenTip(close)
    const onDown = (e: PointerEvent) => {
      if (!btnRef.current?.contains(e.target as Node)) close()
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => {
      unregister()
      document.removeEventListener('pointerdown', onDown, true)
    }
  }, [open, close])

  // Closing the tooltip when the setting goes off or the dot unmounts is handled by the effect above.
  useLayoutEffect(() => {
    if (!open || !btnRef.current || !tipRef.current) return
    const size = tipRef.current.getBoundingClientRect()
    const avoid = Array.from(document.querySelectorAll(AVOID_SELECTOR)).map((el) =>
      toRect(el.getBoundingClientRect()),
    )
    setPos(
      placeTooltip(
        toRect(btnRef.current.getBoundingClientRect()),
        { width: size.width, height: size.height },
        { width: window.innerWidth, height: window.innerHeight },
        avoid,
      ),
    )
  }, [open])

  if (text === null) return null
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="info-dot"
        aria-label={label ?? 'More information'}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={close}
        onFocus={() => setOpen(true)}
        onBlur={close}
        onClick={() => setOpen(true)}
      >
        i
      </button>
      {open &&
        createPortal(
          <div
            ref={tipRef}
            id={id}
            role="tooltip"
            className="info-dot__tip"
            style={{ left: pos?.x ?? 0, top: pos?.y ?? 0, visibility: pos ? 'visible' : 'hidden' }}
          >
            {INFO_TIPS[tipKey]}
          </div>,
          document.body,
        )}
    </>
  )
}
