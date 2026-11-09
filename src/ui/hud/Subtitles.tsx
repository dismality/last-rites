import { useEffect, useRef, useState } from 'react'
import { subscribeToType } from '../../game/events'
import { useSettingsStore } from '../../game/state/settingsStore'
import {
  EMPTY_CAPTION_QUEUE,
  expireCaptions,
  pushCaption,
  type CaptionQueue,
} from '../../game/systems/captions'

const nowSeconds = () => performance.now() / 1000

/**
 * Shows `subtitleShown` events through the caption queue: at most 3 lines, each on screen at least
 * 1.5 s, the oldest dropped to make room. Shown at every Scare intensity; none when Subtitles is Off.
 */
export function Subtitles() {
  const enabled = useSettingsStore((s) => s.subtitles)
  const [queue, setQueue] = useState<CaptionQueue>(EMPTY_CAPTION_QUEUE)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const clearTimer = () => {
      if (timer.current !== null) clearTimeout(timer.current)
      timer.current = null
    }
    // One timer, aimed at the next line to expire; re-armed after every change.
    const schedule = (q: CaptionQueue) => {
      clearTimer()
      if (q.items.length === 0) return
      const next = Math.min(...q.items.map((c) => c.expiresAt))
      timer.current = setTimeout(
        () => {
          setQueue((cur) => {
            const after = expireCaptions(cur, nowSeconds())
            schedule(after)
            return after
          })
        },
        Math.max(0, (next - nowSeconds()) * 1000) + 5,
      )
    }

    const unsubscribe = subscribeToType('subtitleShown', (e) => {
      setQueue((cur) => {
        const now = nowSeconds()
        // `force` is for scares at intensity Off: the caption is then the only description of the event.
        const next = pushCaption(expireCaptions(cur, now), e, now, enabled)
        schedule(next)
        return next
      })
    })
    return () => {
      unsubscribe()
      clearTimer()
      setQueue(EMPTY_CAPTION_QUEUE)
    }
  }, [enabled])

  if (queue.items.length === 0) return null

  return (
    <div className="hud-subtitles" role="log" aria-live="polite">
      {queue.items.map((c) => (
        <p key={c.id} className="hud-subtitles__line">
          {c.text}
        </p>
      ))}
    </div>
  )
}
