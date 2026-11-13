// The big map (spec 09 task 11l): M opens a full-screen pencil map with up to three pins.
// Same sheet and drawing code as the Journal map, drawn under a zoom and pan transform, with the
// marks, pins and quill kept at a fixed screen size. Mouse: wheel zoom, drag pan, click to pin.
// Keyboard: arrows move a cursor, Enter pins, Delete removes, 1-3 select, +/- zoom, Esc or M close.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PLAYABLE_BOUNDS } from '../../data/cemeteryLayout'
import { iconUrl } from '../../data/assets'
import { MAP_CELL_SIZE, MAP_PX } from '../../data/mapLandmarks'
import { useGameStore, useMapStore, usePlayerStore, useSettingsStore } from '../../game/state'
import { useGuidanceStore } from '../../game/state/guidanceStore'
import { useIntroStore } from '../../game/state/introStore'
import { isOverlayOpen } from '../../game/state/menuState'
import { usePinStore } from '../../game/state/pinStore'
import { useUiWorldStore } from '../../game/state/uiWorldStore'
import {
  centerOn,
  clampView,
  fitView,
  panBy,
  screenToWorld,
  worldToScreen,
  zoomAt,
  type BigMapView,
  type Viewport,
} from '../../game/systems/bigMapView'
import {
  PIN_GLYPHS,
  PIN_SLOTS,
  clampToBounds,
  pinBySlot,
  pinDistance,
  type PinSlot,
} from '../../game/systems/mapPins'
import { keyLabel } from '../../game/systems/interaction'
import { exploredCells, isExplored } from '../../game/systems/mapReveal'
import { MAP_MARK_PX, drawCell, drawLandmark, drawObjective, drawQuill, type MapProjection } from '../journal/mapDraw'
import { useMapMarks } from '../journal/useMapMarks'
import { drawMarkImage, marksVersion, onMarksLoaded } from '../markImages'
import { clickMap, pinAt, type MapClickGeometry } from './mapClick'
import { drawPinGlyph } from './pinDraw'
import { pinsForDraw } from './pinsForDraw'
import './bigMap.css'

const SHEET_PX_PER_M = MAP_PX.cellPx / MAP_CELL_SIZE
/** Cursor step for the arrow keys, in screen pixels. */
const CURSOR_STEP_PX = 24
const PIN_PX = 28
const DRAG_THRESHOLD_PX = 4
const ZOOM_KEY_FACTOR = 1.4

const PAPER = '#d8c9a3'
const GRAPHITE = '#3a2f22'

function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

/** Esc and M must be left to the screens that own the keyboard. */
function mapKeyBlocked(): boolean {
  const gs = useGameStore.getState()
  const ui = useUiWorldStore.getState()
  return (
    gs.screen !== 'game' ||
    gs.paused ||
    gs.examining ||
    gs.journalOpen ||
    gs.satchelOpen ||
    gs.taken ||
    useIntroStore.getState().playing ||
    ui.workbenchOpen ||
    ui.chapelRepairOpen ||
    isOverlayOpen()
  )
}

/** Mount once. Owns the M key; renders the overlay while the map is open. */
export function BigMap() {
  const open = useGameStore((s) => s.mapOpen)
  const screen = useGameStore((s) => s.screen)

  useEffect(() => {
    if (screen !== 'game') return
    const onKey = (e: KeyboardEvent) => {
      const gs = useGameStore.getState()
      if (e.code === useSettingsStore.getState().bindings.Map && !e.repeat) {
        const t = e.target
        if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return
        if (gs.mapOpen) {
          e.preventDefault()
          e.stopPropagation()
          gs.setMapOpen(false)
        } else if (!mapKeyBlocked()) {
          e.preventDefault()
          // Ink the cell the player is standing in even if they haven't moved yet.
          useMapStore.getState().reveal(usePlayerStore.getState().position)
          gs.setMapOpen(true)
        }
      } else if (e.code === 'Escape' && gs.mapOpen) {
        // Capture phase, so the pause trigger never sees it.
        e.preventDefault()
        e.stopPropagation()
        gs.setMapOpen(false)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [screen])

  if (!open || screen !== 'game') return null
  return <BigMapBody onClose={() => useGameStore.getState().setMapOpen(false)} />
}

function BigMapBody({ onClose }: { onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [viewport, setViewport] = useState<Viewport>({ width: window.innerWidth, height: window.innerHeight })
  const [view, setView] = useState<BigMapView | null>(null)
  const map = useMapStore((s) => s.map)
  const pins = usePinStore((s) => s.pins)
  const position = usePlayerStore((s) => s.position)
  const yaw = usePlayerStore((s) => s.yaw)
  const objective = useGuidanceStore((s) => s.objective)
  const { landmarks, extraMarks } = useMapMarks()
  const [selected, setSelected] = useState<PinSlot | null>(null)
  const [cursor, setCursor] = useState<{ x: number; z: number } | null>(null)
  const [status, setStatus] = useState('')
  const [marksV, setMarksV] = useState(marksVersion())
  useEffect(() => onMarksLoaded(() => setMarksV(marksVersion())), [])

  // The overlay's size follows the window.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const measure = () => {
      const r = canvas.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) setViewport({ width: r.width, height: r.height })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [])

  // First view: centred on the player at a close zoom, so "where am I" is answered at once.
  const effective = useMemo(() => {
    if (view) return clampView(view, viewport)
    return centerOn(zoomAt(fitView(viewport), viewport, viewport.width / 2, viewport.height / 2, 3), viewport, position[0], position[2])
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the first view reads the position
  }, [view, viewport])
  // Event handlers read the latest view and size through refs, written after each render.
  const viewRef = useRef(effective)
  const vpRef = useRef(viewport)
  useEffect(() => {
    viewRef.current = effective
    vpRef.current = viewport
  })

  // Marking the sheet as seen: the big map draws every cell at once.
  useEffect(() => {
    useMapStore.getState().markSeen()
  }, [])

  const geometry = useCallback(
    (): MapClickGeometry => ({
      project: (x, z) => worldToScreen(viewRef.current, x, z),
      unproject: (px, py) => screenToWorld(viewRef.current, px, py),
    }),
    [],
  )
  const clickLandmarks = useMemo(
    () => landmarks.map((l) => ({ name: l.name, x: l.position[0], z: l.position[2] })),
    [landmarks],
  )

  const announce = (r: ReturnType<typeof clickMap>) =>
    setStatus(
      r.kind === 'removed'
        ? `Pin ${r.pin.slot} removed.`
        : `Pin ${r.pin.slot} placed: ${r.pin.name}, ${Math.round(pinDistance(r.pin, { x: position[0], z: position[2] }))} metres away.`,
    )

  // ── Drawing ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = window.devicePixelRatio || 1
    const w = Math.max(1, Math.round(viewport.width * dpr))
    const h = Math.max(1, Math.round(viewport.height * dpr))
    if (canvas.width !== w) canvas.width = w
    if (canvas.height !== h) canvas.height = h
    const v = effective
    const reduced = prefersReducedMotion()

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, viewport.width, viewport.height)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    // Explored cells, under the zoom transform. Line width is held at about 1.4 screen px.
    ctx.save()
    ctx.setTransform(dpr * v.k, 0, 0, dpr * v.k, dpr * v.ox, dpr * v.oy)
    for (const cell of exploredCells(map)) drawCell(ctx, cell, 1, reduced, 1.4 / v.k)
    ctx.restore()

    // The edge of the playable ground, so a pin on blank paper still has a place.
    ctx.save()
    const [bx0, by0] = worldToScreen(v, -PLAYABLE_BOUNDS.halfX, -PLAYABLE_BOUNDS.halfZ)
    const [bx1, by1] = worldToScreen(v, PLAYABLE_BOUNDS.halfX, PLAYABLE_BOUNDS.halfZ)
    ctx.setLineDash([8, 6])
    ctx.strokeStyle = GRAPHITE
    ctx.globalAlpha = 0.45
    ctx.lineWidth = 1.5
    ctx.strokeRect(bx0, by0, bx1 - bx0, by1 - by0)
    ctx.restore()

    // Marks at a fixed screen size.
    for (const l of landmarks) {
      const [x, y] = worldToScreen(v, l.position[0], l.position[2])
      drawLandmark(ctx, l.kind, x, y)
    }
    for (const m of extraMarks) {
      const [x, y] = worldToScreen(v, m.x, m.z)
      ctx.save()
      ctx.translate(x, y)
      if (!drawMarkImage(ctx, iconUrl('mark-dark', m.id), MAP_MARK_PX)) {
        ctx.fillStyle = GRAPHITE
        ctx.font = '18px "IM Fell English", serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(m.glyph, 0, 0)
      }
      ctx.restore()
    }
    for (const { pin, unexplored, selected: sel } of pinsForDraw(pins, map, selected)) {
      const [x, y] = worldToScreen(v, pin.x, pin.z)
      drawPinGlyph(ctx, pin.slot, x, y, { size: PIN_PX, unexplored, selected: sel })
    }
    const proj: MapProjection = {
      toPx: (x, z) => worldToScreen(v, x, z),
      clamp: (px, py) => [
        Math.min(viewport.width - 16, Math.max(16, px)),
        Math.min(viewport.height - 16, Math.max(16, py)),
      ],
      width: viewport.width,
    }
    drawObjective(ctx, objective, proj)
    drawQuill(ctx, { x: position[0], z: position[2], yaw }, proj)

    if (cursor) {
      const [x, y] = worldToScreen(v, cursor.x, cursor.z)
      ctx.save()
      ctx.translate(x, y)
      for (const [color, width] of [[PAPER, 5], [GRAPHITE, 2]] as const) {
        ctx.strokeStyle = color
        ctx.lineWidth = width
        ctx.beginPath()
        ctx.moveTo(-12, 0)
        ctx.lineTo(-4, 0)
        ctx.moveTo(4, 0)
        ctx.lineTo(12, 0)
        ctx.moveTo(0, -12)
        ctx.lineTo(0, -4)
        ctx.moveTo(0, 4)
        ctx.lineTo(0, 12)
        ctx.stroke()
      }
      ctx.restore()
    }
  }, [effective, viewport, map, pins, selected, cursor, landmarks, extraMarks, objective, position, yaw, marksV])

  // ── Mouse ──────────────────────────────────────────────────────────────────
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null)

  const local = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = canvasRef.current!.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top]
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = canvas.getBoundingClientRect()
      const factor = Math.exp(-e.deltaY * 0.0015)
      setView((cur) => zoomAt(cur ?? viewRef.current, vpRef.current, e.clientX - r.left, e.clientY - r.top, factor))
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [])

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const [x, y] = local(e)
    drag.current = { x, y, moved: false }
  }
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current
    if (!d) return
    const [x, y] = local(e)
    if (!d.moved && Math.hypot(x - d.x, y - d.y) < DRAG_THRESHOLD_PX) return
    d.moved = true
    const dx = x - d.x
    const dy = y - d.y
    d.x = x
    d.y = y
    setView((cur) => panBy(cur ?? viewRef.current, vpRef.current, dx, dy))
  }
  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current
    drag.current = null
    if (!d || e.button !== 0 || d.moved) return
    const [x, y] = local(e)
    const r = clickMap(geometry(), clickLandmarks, x, y)
    setSelected(r.kind === 'placed' ? r.pin.slot : null)
    announce(r)
  }
  const onContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const [x, y] = local(e)
    const store = usePinStore.getState()
    const hit = pinAt(store.pins, geometry(), x, y)
    if (hit) {
      store.remove(hit.slot)
      setSelected(null)
      setStatus(`Pin ${hit.slot} removed.`)
    }
  }

  // ── Keyboard ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    canvas?.focus()
  }, [])

  const moveCursorTo = useCallback((x: number, z: number) => {
    const [cx, cz] = clampToBounds(x, z)
    setCursor({ x: cx, z: cz })
    setView((cur) => {
      const v = cur ?? viewRef.current
      const [sx, sy] = worldToScreen(v, cx, cz)
      const vp = vpRef.current
      const m = 48
      return sx < m || sy < m || sx > vp.width - m || sy > vp.height - m ? centerOn(v, vp, cx, cz) : v
    })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return
      const onButton = t instanceof HTMLButtonElement
      const player = usePlayerStore.getState().position
      const at = cursor ?? { x: player[0], z: player[2] }
      const stepM = CURSOR_STEP_PX / (viewRef.current.k * SHEET_PX_PER_M)
      const handled = () => {
        e.preventDefault()
        e.stopPropagation()
      }
      switch (e.code) {
        case 'ArrowLeft':
          handled()
          moveCursorTo(at.x - stepM, at.z)
          return
        case 'ArrowRight':
          handled()
          moveCursorTo(at.x + stepM, at.z)
          return
        case 'ArrowUp':
          handled()
          moveCursorTo(at.x, at.z - stepM)
          return
        case 'ArrowDown':
          handled()
          moveCursorTo(at.x, at.z + stepM)
          return
        case 'Enter':
        case 'NumpadEnter': {
          if (onButton) return
          handled()
          setCursor(at)
          const r = clickMap(geometry(), clickLandmarks, ...worldToScreen(viewRef.current, at.x, at.z))
          setSelected(r.kind === 'placed' ? r.pin.slot : null)
          announce(r)
          return
        }
        case 'Delete':
        case 'Backspace': {
          if (onButton) return
          handled()
          const store = usePinStore.getState()
          const under = pinAt(store.pins, geometry(), ...worldToScreen(viewRef.current, at.x, at.z))
          const target = under ?? (selected ? pinBySlot(store.pins, selected) : undefined)
          if (target) {
            store.remove(target.slot)
            setSelected(null)
            setStatus(`Pin ${target.slot} removed.`)
          }
          return
        }
        case 'Digit1':
        case 'Digit2':
        case 'Digit3':
        case 'Numpad1':
        case 'Numpad2':
        case 'Numpad3': {
          handled()
          const slot = Number(e.code.slice(-1)) as PinSlot
          const pin = pinBySlot(usePinStore.getState().pins, slot)
          if (pin) {
            setSelected(slot)
            moveCursorTo(pin.x, pin.z)
            setStatus(`Pin ${slot} selected: ${pin.name}.`)
          } else setStatus(`Pin ${slot} is not placed.`)
          return
        }
        case 'Equal':
        case 'NumpadAdd':
        case 'Minus':
        case 'NumpadSubtract': {
          handled()
          const zoomIn = e.code === 'Equal' || e.code === 'NumpadAdd'
          const v = viewRef.current
          const [sx, sy] = cursor ? worldToScreen(v, cursor.x, cursor.z) : [vpRef.current.width / 2, vpRef.current.height / 2]
          setView(zoomAt(v, vpRef.current, sx, sy, zoomIn ? ZOOM_KEY_FACTOR : 1 / ZOOM_KEY_FACTOR))
          return
        }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
    // announce reads the latest position through the closure below, so keep it fresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, selected, moveCursorTo, geometry, clickLandmarks, position])

  const mapKey = useSettingsStore((s) => s.bindings.Map ?? 'KeyM')
  const clear = usePinStore((s) => s.clear)
  const remove = usePinStore((s) => s.remove)
  const player = { x: position[0], z: position[2] }
  const sorted = [...pins].sort((a, b) => a.slot - b.slot)

  return (
    <div className="bigmap" role="dialog" aria-modal="true" aria-label="Map">
      <canvas
        ref={canvasRef}
        className="bigmap__canvas"
        tabIndex={0}
        role="application"
        aria-label={`Hand-drawn map of Hollowmere Cemetery with ${pins.length} of 3 pins. Arrow keys move the cursor, Enter places a pin, Delete removes one, 1 to 3 select a pin, plus and minus zoom.`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (drag.current = null)}
        onContextMenu={onContextMenu}
      />
      <section className="bigmap__panel bigmap__panel--help" aria-label="Map help">
        <h2 className="bigmap__title">Hollowmere</h2>
        <p>Wheel zooms. Drag pans. Click to drop a pin.</p>
        <p>Keys: arrows, Enter, Delete, 1 to 3, + and −.</p>
        <p className="bigmap__status" role="status" aria-live="polite">
          {status}
        </p>
      </section>
      <section className="bigmap__panel bigmap__panel--legend" aria-label="Pins">
        <h3 className="bigmap__subtitle">Pins {pins.length}/3</h3>
        {sorted.length === 0 ? (
          <p>No pins placed.</p>
        ) : (
          <ul className="bigmap__pins">
            {sorted.map((p) => {
              const unexplored = !isExplored(map, Math.floor(p.x / MAP_CELL_SIZE), Math.floor(p.z / MAP_CELL_SIZE))
              return (
                <li key={p.slot} className="bigmap__pin" data-selected={p.slot === selected ? 'true' : undefined}>
                  <button
                    type="button"
                    className="bigmap__pinbtn"
                    onClick={() => {
                      setSelected(p.slot)
                      moveCursorTo(p.x, p.z)
                    }}
                  >
                    <span aria-hidden="true">{PIN_GLYPHS[p.slot]}</span> {p.name}
                    {unexplored ? ' ?' : ''} · {Math.round(pinDistance(p, player))} m
                  </button>
                  <button
                    type="button"
                    className="bigmap__remove"
                    aria-label={`Remove pin ${p.slot}`}
                    onClick={() => {
                      remove(p.slot)
                      setStatus(`Pin ${p.slot} removed.`)
                    }}
                  >
                    ✕
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <div className="bigmap__actions">
          <button type="button" className="bigmap__btn" onClick={clear} disabled={pins.length === 0}>
            Clear all
          </button>
          <button type="button" className="bigmap__btn" onClick={onClose}>
            Close map
          </button>
        </div>
        <p className="bigmap__note">
          {PIN_SLOTS.map((s) => PIN_GLYPHS[s]).join(' ')} circle, square, triangle. Esc or {keyLabel(mapKey)} closes.
        </p>
      </section>
    </div>
  )
}
