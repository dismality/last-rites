import { useEffect, useRef } from 'react'
import { iconUrl } from '../../data/assets'
import { COMPASS, COMPASS_LETTERS, COMPASS_MARK_ID, type CompassMarkerKind } from '../../data/compass'
import { HUD_MARK_PX } from '../markImages'
import { MERCHANT_SPOT } from '../../data/merchant'
import { isMerchantPresent } from '../../game/state/merchantPresence'
import { useChapelStore } from '../../game/state/chapelStore'
import { useGuidanceStore } from '../../game/state/guidanceStore'
import { usePinStore } from '../../game/state/pinStore'
import { usePlayerStore } from '../../game/state/playerStore'
import { useWorldStore } from '../../game/state/worldStore'
import { buildCompassMarkers, compassTicks, headingDeg } from '../../game/systems/compass'
import type { CompassMarker } from '../../game/systems/compass'
import { layoutCompassLabels, type LabelBox } from '../../game/systems/compassLayout'
import { isBellActive } from '../../game/systems/repairs'
import './Compass.css'

const TICK_ANGLES: number[] = Array.from({ length: 360 / COMPASS.tickStepDeg }, (_, i) => i * COMPASS.tickStepDeg)
const LETTERS = COMPASS_LETTERS as Readonly<Record<number, string>>

const pct = (x: number): string => `${50 + x * 50}%`

/** Writes text only when it changed, so per-frame updates stay cheap. */
const setText = (el: Element, text: string): void => {
  if (el.textContent !== text) el.textContent = text
}

function syncMarker(el: HTMLElement, m: CompassMarker): void {
  el.style.left = pct(m.x)
  el.dataset.pinned = m.pinned ?? ''
  const arrow = el.querySelector('.compass__arrow')
  const text = el.querySelector('.compass__text')
  if (arrow) setText(arrow, m.pinned === 'left' ? '◂' : m.pinned === 'right' ? '▸' : '')
  // The image replaces the glyph once it has loaded; until then, or if it fails, the glyph stays.
  if (text) setText(text, el.dataset.mark === 'img' ? m.label : `${m.glyph} ${m.label}`)
}

/** The mark image for a marker, with its load state mirrored onto the marker element. */
function makeMarkImg(el: HTMLElement, id: string): HTMLImageElement {
  const img = document.createElement('img')
  img.className = 'compass__mark'
  img.alt = ''
  img.width = HUD_MARK_PX
  img.height = HUD_MARK_PX
  img.draggable = false
  img.hidden = true
  const prefix = id.split('-')[0]
  if (prefix === 'pin') {
    // Pins have no mark image: the circled number is the mark.
    el.dataset.mark = 'glyph'
    return img
  }
  const kind = prefix as CompassMarkerKind
  img.onload = () => {
    img.hidden = false
    el.dataset.mark = 'img'
  }
  img.onerror = () => {
    img.hidden = true
    el.dataset.mark = 'glyph'
  }
  img.src = iconUrl('mark-light', COMPASS_MARK_ID[kind])
  return img
}

function makeMarkerEl(id: string): HTMLElement {
  const el = document.createElement('div')
  el.className = `compass__marker compass__marker--${id.split('-')[0]}`
  const arrow = document.createElement('span')
  arrow.className = 'compass__arrow'
  arrow.setAttribute('aria-hidden', 'true')
  const text = document.createElement('span')
  text.className = 'compass__text'
  el.append(arrow, makeMarkImg(el, id), text)
  return el
}

/**
 * Heading strip. Yaw and position change every frame, so a rAF loop reads the stores
 * with getState() and writes DOM styles directly; React never re-renders per frame.
 */
export function Compass() {
  const markerLayer = useRef<HTMLDivElement>(null)
  const tickRefs = useRef<(HTMLDivElement | null)[]>([])
  const pool = useRef(new Map<string, HTMLElement>())

  useEffect(() => {
    const layer = markerLayer.current
    const els = pool.current
    let raf = 0
    const frame = (): void => {
      raf = requestAnimationFrame(frame)
      const player = usePlayerStore.getState()
      const [px, , pz] = player.position
      if (!Number.isFinite(player.yaw) || !Number.isFinite(px) || !Number.isFinite(pz)) return
      const heading = headingDeg(player.yaw)

      const visible = new Map(compassTicks(heading).map((t) => [Math.round(((heading + t.rel) % 360 + 360) % 360), t.rel]))
      TICK_ANGLES.forEach((a, i) => {
        const el = tickRefs.current[i]
        if (!el) return
        const rel = visible.get(a)
        el.style.display = rel === undefined ? 'none' : ''
        if (rel !== undefined) el.style.left = pct(rel / COMPASS.halfSpanDeg)
      })

      const markers = buildCompassMarkers({
        player: { x: px, z: pz },
        heading,
        objective: useGuidanceStore.getState().objective?.position,
        phase: useWorldStore.getState().phase,
        bellBuilt: isBellActive(useChapelStore.getState().chapel),
        merchant: isMerchantPresent() ? MERCHANT_SPOT.silas : undefined,
        pins: usePinStore.getState().pins,
      })
      if (!layer) return
      const seen = new Set<string>()
      const half = layer.clientWidth / 2
      const placed: { m: CompassMarker; el: HTMLElement }[] = []
      for (const m of markers) {
        seen.add(m.id)
        let el = els.get(m.id)
        if (!el) {
          el = makeMarkerEl(m.id)
          els.set(m.id, el)
          layer.appendChild(el)
        }
        syncMarker(el, m)
        // Unhide before measuring: a hidden label has no width, and would creep back under a neighbour.
        el.hidden = false
        placed.push({ m, el })
      }
      // Real widths (mark image, glyph and text), read after every write so layout runs once.
      const boxes: LabelBox[] = placed.map(({ m, el }) => ({
        id: m.id,
        centerPx: half + m.x * half,
        widthPx: el.offsetWidth > 0 ? el.offsetWidth : (el.textContent?.length ?? 0) * COMPASS.glyphWidthPx + COMPASS.markerPadPx,
        pinned: m.pinned,
        droppable: m.id.startsWith('spawn-'),
      }))
      // Labels that would overlap stack on a second row or slide aside, never draw over each other.
      const layout = new Map(layoutCompassLabels(boxes).map((p) => [p.id, p]))
      for (const { m, el } of placed) {
        const p = layout.get(m.id)
        if (!p) continue
        el.style.marginLeft = p.shiftPx === 0 ? '' : `${p.shiftPx}px`
        el.hidden = p.hidden
        el.dataset.lane = String(p.lane)
      }
      for (const [id, el] of els) {
        if (!seen.has(id)) {
          el.remove()
          els.delete(id)
        }
      }
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      for (const el of els.values()) el.remove()
      els.clear()
    }
  }, [])

  return (
    <div className="compass" role="img" aria-label="Compass">
      <div className="compass__track">
        {TICK_ANGLES.map((a, i) => (
          <div
            key={a}
            className={`compass__tick${LETTERS[a] ? ' compass__tick--letter' : ''}`}
            ref={(el) => {
              tickRefs.current[i] = el
            }}
          >
            {LETTERS[a] ? <span className="compass__letter">{LETTERS[a]}</span> : null}
          </div>
        ))}
        <div className="compass__markers" ref={markerLayer} />
      </div>
      <div className="compass__center" aria-hidden="true">▾</div>
    </div>
  )
}
