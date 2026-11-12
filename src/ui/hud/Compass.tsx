import { useEffect, useRef } from 'react'
import { iconUrl } from '../../data/assets'
import { COMPASS, COMPASS_LETTERS, COMPASS_MARK_ID, type CompassMarkerKind } from '../../data/compass'
import { HUD_MARK_PX } from '../markImages'
import { MERCHANT_SPOT } from '../../data/merchant'
import { isMerchantPresent } from '../../game/state/merchantPresence'
import { useChapelStore } from '../../game/state/chapelStore'
import { useGuidanceStore } from '../../game/state/guidanceStore'
import { usePlayerStore } from '../../game/state/playerStore'
import { useWorldStore } from '../../game/state/worldStore'
import { buildCompassMarkers, compassTicks, headingDeg } from '../../game/systems/compass'
import type { CompassMarker } from '../../game/systems/compass'
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
  const kind = id.split('-')[0] as CompassMarkerKind
  const img = document.createElement('img')
  img.className = 'compass__mark'
  img.alt = ''
  img.width = HUD_MARK_PX
  img.height = HUD_MARK_PX
  img.draggable = false
  img.hidden = true
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
      })
      if (!layer) return
      const seen = new Set<string>()
      // Two lanes: a marker that would overlap one already placed drops to the second lane,
      // so labels such as "Hut" and "Chapel" stay readable when they share a bearing.
      const half = layer.clientWidth / 2
      const lane0: [number, number][] = []
      const lane1: [number, number][] = []
      for (const m of markers) {
        seen.add(m.id)
        let el = els.get(m.id)
        if (!el) {
          el = makeMarkerEl(m.id)
          els.set(m.id, el)
          layer.appendChild(el)
        }
        syncMarker(el, m)
        const w = (el.textContent?.length ?? 0) * COMPASS.glyphWidthPx + COMPASS.markerPadPx
        const c = half + m.x * half
        const span: [number, number] =
          m.pinned === 'left' ? [c, c + w] : m.pinned === 'right' ? [c - w, c] : [c - w / 2, c + w / 2]
        const overlaps = (lane: [number, number][]) => lane.some(([a, b]) => span[0] < b && span[1] > a)
        let laneNo = 0
        if (overlaps(lane0)) laneNo = 1
        if (laneNo === 1 && overlaps(lane1) && m.id.startsWith('spawn-')) laneNo = -1
        // A skull that would sit on top of another label is dropped: the nearer ones already
        // show that direction, and unreadable overlap helps nobody.
        // Always-on markers (chapel, hut, objective) are never dropped: when both lanes are
        // taken they slide sideways along the second lane until they clear their neighbour.
        let shift = 0
        if (laneNo === 1) {
          for (const [a, b] of lane1) {
            const s0 = span[0] + shift
            const s1 = span[1] + shift
            if (s0 < b && s1 > a) shift = m.pinned === 'right' ? shift - (s1 - a) : shift + (b - s0)
          }
          span[0] += shift
          span[1] += shift
        }
        el.style.marginLeft = shift === 0 ? '' : `${shift}px`
        if (laneNo === 0) lane0.push(span)
        else if (laneNo === 1) lane1.push(span)
        el.hidden = laneNo === -1
        el.dataset.lane = String(Math.max(0, laneNo))
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
