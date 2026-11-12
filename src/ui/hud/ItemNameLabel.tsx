import { useEffect, useRef } from 'react'
import { useItemNameStore } from '../../game/state/itemNameStore'
import { useGameStore } from '../../game/state/gameStore'
import { useCinematic } from '../../game/state/menuState'
import { itemNameFinished, itemNameOpacity } from '../../game/systems/itemNameLabel'
import './ItemNameLabel.css'

const reducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

/**
 * The shared item-name label. Opacity is driven from the real clock on animation frames,
 * so it keeps fading while paused or inside a menu, and a new name restarts it at once.
 * Mounted at App level (above the satchel and other overlays), hidden in the intro and endings.
 */
export function ItemNameLabel() {
  const name = useItemNameStore((s) => s.name)
  const ticket = useItemNameStore((s) => s.ticket)
  const screen = useGameStore((s) => s.screen)
  const cinematic = useCinematic()
  const ref = useRef<HTMLDivElement>(null)
  const visible = name !== null && screen === 'game' && !cinematic

  useEffect(() => {
    const el = ref.current
    if (!visible || !el) return
    let raf = 0
    const tick = () => {
      const { shownAt } = useItemNameStore.getState()
      const elapsed = performance.now() - shownAt
      const reduced = reducedMotion()
      el.style.opacity = String(itemNameOpacity(elapsed, reduced))
      if (itemNameFinished(elapsed, reduced)) {
        // Remove the element once faded: an invisible live region left mounted is stale text.
        useItemNameStore.getState().expire(ticket)
        return
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [visible, ticket])

  if (!visible) return null
  return (
    <div ref={ref} className="item-name-label" role="status" aria-live="polite">
      {name}
    </div>
  )
}
