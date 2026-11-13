// Journal map: the keeper's pencil sketch. Canvas 2D; cells explored since the
// journal was last open ink themselves in, one after another (fade when reduced motion).
// Pins (spec 09 task 11l) show here and can be placed or removed with the mouse.
import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { MAP_INK } from '../../data/mapLandmarks'
import { useMapStore, usePlayerStore } from '../../game/state'
import { useGuidanceStore } from '../../game/state/guidanceStore'
import { usePinStore } from '../../game/state/pinStore'
import { mapToWorld, worldToMap } from '../../game/systems/mapProject'
import { PIN_GLYPHS, pinDistance, type Pin } from '../../game/systems/mapPins'
import { cellKey, exploredCells } from '../../game/systems/mapReveal'
import { clickMap, pinAt } from '../map/mapClick'
import { pinsForDraw } from '../map/pinsForDraw'
import { marksVersion, onMarksLoaded } from '../markImages'
import { MAP_HEIGHT, MAP_WIDTH, drawMap } from './mapDraw'
import { useMapMarks } from './useMapMarks'

const KIND_LABEL = { workbench: 'Workbench', chapel: 'Chapel', gate: 'Gate', relic: 'Relic site' } as const

const EXTRA_LABEL: Partial<Record<string, string>> = {
  hut: "Keeper's hut",
  merchant: 'Silas, the undertaker',
  graves: 'Open graves',
}

function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

export function JournalMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const map = useMapStore((s) => s.map)
  const px = usePlayerStore((s) => s.position)
  const yaw = usePlayerStore((s) => s.yaw)
  const objective = useGuidanceStore((s) => s.objective)
  const pins = usePinStore((s) => s.pins)
  const { landmarks, extraMarks } = useMapMarks()
  const drawnPins = useMemo(() => pinsForDraw(pins, map), [pins, map])

  // Images load after the first draw; redraw once each is in.
  const [marksV, setMarksV] = useState(marksVersion())
  useEffect(() => onMarksLoaded(() => setMarksV(marksVersion())), [])

  // Snapshot what is new at open time; the store clears it once the animation ends.
  const pendingKeys = useRef<string[]>(useMapStore.getState().unseen.map((c) => cellKey(c.cx, c.cz)))

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const reduced = prefersReducedMotion()
    const cells = exploredCells(map)
    const order = new Map(pendingKeys.current.map((k, i) => [k, i]))
    const start = performance.now()
    let raf = 0

    const frame = (now: number) => {
      const elapsed = now - start
      let done = true
      const drawn = cells.map((cell) => {
        const idx = order.get(cellKey(cell.cx, cell.cz))
        if (idx === undefined) return { cell, progress: 1 }
        const delay = Math.min(idx * MAP_INK.staggerMs, MAP_INK.maxTotalDelayMs)
        const progress = Math.min(1, Math.max(0, (elapsed - delay) / MAP_INK.cellDurationMs))
        if (progress < 1) done = false
        return { cell, progress }
      })
      drawMap(ctx, {
        cells: drawn,
        landmarks,
        extraMarks,
        pins: drawnPins,
        player: { x: px[0], z: px[2], yaw },
        objective,
        reducedMotion: reduced,
      })
      if (done) {
        pendingKeys.current = []
        useMapStore.getState().markSeen()
      } else {
        raf = requestAnimationFrame(frame)
      }
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [map, landmarks, extraMarks, drawnPins, marksV, px, yaw, objective])

  /** Canvas is scaled by CSS, so a click is converted to sheet pixels before it is projected. */
  const onClick = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const sx = ((e.clientX - rect.left) * MAP_WIDTH) / rect.width
    const sy = ((e.clientY - rect.top) * MAP_HEIGHT) / rect.height
    clickMap(
      { project: worldToMap, unproject: mapToWorld },
      landmarks.map((l) => ({ name: l.name, x: l.position[0], z: l.position[2] })),
      sx,
      sy,
    )
  }
  /** Right-click only ever removes a pin. */
  const onContext = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const sx = ((e.clientX - rect.left) * MAP_WIDTH) / rect.width
    const sy = ((e.clientY - rect.top) * MAP_HEIGHT) / rect.height
    const store = usePinStore.getState()
    const hit = pinAt(store.pins, { project: worldToMap, unproject: mapToWorld }, sx, sy)
    if (hit) store.remove(hit.slot)
  }

  const explored = exploredCells(map).length
  return (
    <figure className="journal-map">
      <canvas
        ref={canvasRef}
        width={MAP_WIDTH}
        height={MAP_HEIGHT}
        className="journal-map__canvas"
        role="img"
        aria-label={`Hand-drawn map of Hollowmere Cemetery. ${explored} areas explored. ${landmarks.length} landmarks found. ${pins.length} of 3 pins placed. Click to place or remove a pin.`}
        onClick={onClick}
        onContextMenu={onContext}
      />
      <figcaption className="journal-map__legend">
        <p>Quill mark: you, pointing the way you face.</p>
        <PinList pins={pins} player={{ x: px[0], z: px[2] }} />
        {landmarks.length === 0 ? (
          <p>No landmarks sketched yet.</p>
        ) : (
          <ul>
            {landmarks.map((l) => (
              <li key={l.id}>
                <strong>{KIND_LABEL[l.kind]}:</strong> {l.name}
              </li>
            ))}
            {[...new Set(extraMarks.map((m) => m.id))].map((id) => (
              <li key={id}>
                <strong>{EXTRA_LABEL[id] ?? id}</strong>
              </li>
            ))}
          </ul>
        )}
      </figcaption>
    </figure>
  )
}

/** Pin list with buttons, so a pin can be removed from the keyboard here too. */
function PinList({ pins, player }: { pins: readonly Pin[]; player: { x: number; z: number } }) {
  const remove = usePinStore((s) => s.remove)
  const clear = usePinStore((s) => s.clear)
  return (
    <div className="journal-map__pins">
      <p>Click the map to drop a pin (up to 3). Click a pin to take it off.</p>
      {pins.length > 0 && (
        <ul>
          {[...pins]
            .sort((a, b) => a.slot - b.slot)
            .map((p) => (
              <li key={p.slot}>
                <strong>
                  {PIN_GLYPHS[p.slot]} {p.name}
                </strong>{' '}
                {Math.round(pinDistance(p, player))} m{' '}
                <button type="button" className="journal__close" onClick={() => remove(p.slot)}>
                  Remove pin {p.slot}
                </button>
              </li>
            ))}
        </ul>
      )}
      {pins.length > 1 && (
        <button type="button" className="journal__close" onClick={clear}>
          Clear all
        </button>
      )}
    </div>
  )
}
