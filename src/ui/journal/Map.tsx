// Journal map: the keeper's pencil sketch. Canvas 2D; cells explored since the
// journal was last open ink themselves in, one after another (fade when reduced motion).
import { useEffect, useMemo, useRef } from 'react'
import { LANDMARKS, MAP_INK } from '../../data/mapLandmarks'
import { useMapStore, usePlayerStore, useWorldStore } from '../../game/state'
import { useGuidanceStore } from '../../game/state/guidanceStore'
import { cellKey, discoveredLandmarks, exploredCells } from '../../game/systems/mapReveal'
import { MAP_HEIGHT, MAP_WIDTH, drawMap } from './mapDraw'

const KIND_LABEL = { workbench: 'Workbench', chapel: 'Chapel', gate: 'Gate', relic: 'Relic site' } as const

function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

export function JournalMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const map = useMapStore((s) => s.map)
  const phase = useWorldStore((s) => s.phase)
  const px = usePlayerStore((s) => s.position)
  const yaw = usePlayerStore((s) => s.yaw)
  const objective = useGuidanceStore((s) => s.objective)

  // Locket marker is night-only, like the item itself.
  const landmarks = useMemo(
    () => discoveredLandmarks(map, LANDMARKS).filter((l) => !l.nightOnly || phase === 'night'),
    [map, phase],
  )

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
      drawMap(ctx, { cells: drawn, landmarks, player: { x: px[0], z: px[2], yaw }, objective, reducedMotion: reduced })
      if (done) {
        pendingKeys.current = []
        useMapStore.getState().markSeen()
      } else {
        raf = requestAnimationFrame(frame)
      }
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [map, landmarks, px, yaw, objective])

  const explored = exploredCells(map).length
  return (
    <figure className="journal-map">
      <canvas
        ref={canvasRef}
        width={MAP_WIDTH}
        height={MAP_HEIGHT}
        className="journal-map__canvas"
        role="img"
        aria-label={`Hand-drawn map of Hollowmere Cemetery. ${explored} areas explored. ${landmarks.length} landmarks found.`}
      />
      <figcaption className="journal-map__legend">
        <p>Quill mark: you, pointing the way you face.</p>
        {landmarks.length === 0 ? (
          <p>No landmarks sketched yet.</p>
        ) : (
          <ul>
            {landmarks.map((l) => (
              <li key={l.id}>
                <strong>{KIND_LABEL[l.kind]}:</strong> {l.name}
              </li>
            ))}
          </ul>
        )}
      </figcaption>
    </figure>
  )
}
