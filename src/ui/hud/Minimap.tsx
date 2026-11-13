import { useEffect, useRef } from 'react'
import { LANDMARKS, MAP_INK } from '../../data/mapLandmarks'
import { MINIMAP } from '../../data/minimap'
import { useGuidanceStore } from '../../game/state/guidanceStore'
import { useMapStore } from '../../game/state/mapStore'
import { usePinStore } from '../../game/state/pinStore'
import { cinematicActive, isMenuOpen } from '../../game/state/menuState'
import { usePlayerStore } from '../../game/state/playerStore'
import { useSettingsStore } from '../../game/state/settingsStore'
import { useWorldStore } from '../../game/state/worldStore'
import { cellKey, discoveredLandmarks, isExplored } from '../../game/systems/mapReveal'
import { stepRedraw, type RedrawSample, type RedrawState } from '../../game/systems/minimapRedraw'
import { bearingWord, placeMarker, visibleCellRange, type MinimapGeometry } from '../../game/systems/minimapView'
import { endingCameraRuntime } from '../../scene/effects/endingCameraRuntime'
import { introCameraRuntime } from '../../scene/effects/introCameraRuntime'
import { workbenchCameraRuntime } from '../../scene/world/workbenchCameraRuntime'
import { marksVersion } from '../markImages'
import { drawMinimap } from './minimapDraw'
import { minimapRuntime } from './minimapRuntime'
import './Minimap.css'

const GEOMETRY: MinimapGeometry = { sizePx: MINIMAP.canvasPx, radiusM: MINIMAP.radiusM }

function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

/** Menus, overlays, the workbench view and scripted cameras all hide the map. */
function hiddenNow(): boolean {
  return (
    isMenuOpen() ||
    workbenchCameraRuntime.active ||
    cinematicActive({ ending: endingCameraRuntime.active, intro: introCameraRuntime.active })
  )
}

/**
 * Pencil-sketch minimap, top right under the score. It reads the Journal map's explored cells
 * (mapStore) and draws them with the Journal's own cell and icon code. A rAF loop reads stores
 * with getState() and redraws the canvas only when the gate says so (moved, turned, a cell was
 * revealed, the objective changed, at most 15 a second); React never re-renders per frame.
 */
function MinimapView() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!wrap || !canvas || !ctx) return
    const reduced = prefersReducedMotion()
    const tuning = { moveM: MINIMAP.redrawMoveM, turnDeg: MINIMAP.redrawTurnDeg, maxHz: MINIMAP.maxRedrawHz }

    let raf = 0
    let gate: RedrawState | null = null
    let hidden = false
    let label = ''
    // Cells that were already explored when the map appeared (or at the last reveal) do not ink in.
    let knownRef: object | null = null
    let known = new Set<string>()
    const inkStart = new Map<string, number>()

    const frame = (now: number): void => {
      raf = requestAnimationFrame(frame)
      minimapRuntime.frames++
      const hide = hiddenNow()
      if (hide !== hidden) {
        hidden = hide
        wrap.style.visibility = hide ? 'hidden' : 'visible'
        gate = null // draw straight away when it comes back
      }
      if (hide) return

      const map = useMapStore.getState().map
      if (map !== knownRef) {
        const keys = Object.keys(map.explored)
        if (knownRef !== null) for (const k of keys) if (!known.has(k)) inkStart.set(k, now)
        known = new Set(keys)
        knownRef = map
      }
      for (const [k, t] of inkStart) if (now - t >= MAP_INK.cellDurationMs) inkStart.delete(k)

      const player = usePlayerStore.getState()
      const objective = useGuidanceStore.getState().objective
      const night = useWorldStore.getState().phase === 'night'
      const op = objective?.position
      const pins = usePinStore.getState().pins
      const sample: RedrawSample = {
        x: player.position[0],
        z: player.position[2],
        yaw: player.yaw,
        mapRef: map,
        contentKey: `${night ? 'n' : 'd'}|${op ? `${op[0]},${op[2]}` : ''}|${marksVersion()}|${pins.map((p) => `${p.slot}:${p.x},${p.z}`).join(';')}`,
        animating: inkStart.size > 0,
      }
      if (!Number.isFinite(sample.x) || !Number.isFinite(sample.z) || !Number.isFinite(sample.yaw)) return
      const step = stepRedraw(gate, now, sample, tuning)
      if (!step.redraw) return
      gate = step.state

      const at = { x: sample.x, z: sample.z }
      const range = visibleCellRange(GEOMETRY.radiusM, at)
      const cells = []
      for (let cz = range.minCz; cz <= range.maxCz; cz++) {
        for (let cx = range.minCx; cx <= range.maxCx; cx++) {
          if (!isExplored(map, cx, cz)) continue
          const t = inkStart.get(cellKey(cx, cz))
          const progress = t === undefined ? 1 : Math.min(1, (now - t) / MAP_INK.cellDurationMs)
          cells.push({ cell: { cx, cz }, progress })
        }
      }
      const landmarks = discoveredLandmarks(map, LANDMARKS).filter((l) => !l.nightOnly || night)
      drawMinimap(ctx, {
        geometry: GEOMETRY,
        player: { x: sample.x, z: sample.z, yaw: sample.yaw },
        cells,
        landmarks,
        objective: op ? { x: op[0], z: op[2] } : null,
        pins,
        reducedMotion: reduced,
      })
      minimapRuntime.draws++

      // Screen-reader text: refreshed on redraw only, and written only when it changed.
      let next = 'Minimap, north up.'
      if (op) {
        const m = placeMarker(GEOMETRY, at, { x: op[0], z: op[2] }, MINIMAP.markerInsetPx)
        next += ` Objective ${Math.round(m.distanceM)} metres ${bearingWord(m.angle)}.`
      }
      for (const pin of pins) {
        const m = placeMarker(GEOMETRY, at, pin, MINIMAP.markerInsetPx)
        next += ` Pin ${pin.slot} ${Math.round(m.distanceM)} metres ${bearingWord(m.angle)}.`
      }
      if (next !== label) {
        label = next
        canvas.setAttribute('aria-label', next)
      }
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div ref={wrapRef} className="minimap" data-testid="minimap">
      <canvas
        ref={canvasRef}
        className="minimap__canvas"
        width={MINIMAP.canvasPx}
        height={MINIMAP.canvasPx}
        role="img"
        aria-label="Minimap, north up."
      />
    </div>
  )
}

/** The map, unless the "Show minimap" setting is off (then no loop runs at all). */
export function Minimap() {
  const show = useSettingsStore((s) => s.showMinimap)
  return show ? <MinimapView /> : null
}

/** The rebindable Minimap key flips the setting; it stays mounted while the map is off. */
export function MinimapHotkey() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.repeat) return
      const s = useSettingsStore.getState()
      if (e.code !== s.bindings.Minimap) return
      const t = e.target
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return
      if (hiddenNow()) return
      s.setSetting('showMinimap', !s.showMinimap)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return null
}
