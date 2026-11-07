import { useEffect, useRef, useState } from 'react'
import { subscribeToType } from '../../game/events'
import { useSettingsStore } from '../../game/state/settingsStore'

interface Caption {
  id: number
  text: string
}

/** Shows `subtitleShown` events for their duration (seconds), when settings.subtitles is on. */
export function Subtitles() {
  const enabled = useSettingsStore((s) => s.subtitles)
  const [captions, setCaptions] = useState<Caption[]>([])
  const nextId = useRef(0)
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())

  useEffect(() => {
    if (!enabled) return
    const pending = timers.current
    const unsubscribe = subscribeToType('subtitleShown', (e) => {
      const id = nextId.current++
      setCaptions((c) => [...c, { id, text: e.text }])
      const t = setTimeout(() => {
        pending.delete(t)
        setCaptions((c) => c.filter((x) => x.id !== id))
      }, Math.max(0, e.duration) * 1000)
      pending.add(t)
    })
    return () => {
      unsubscribe()
      pending.forEach(clearTimeout)
      pending.clear()
      setCaptions([])
    }
  }, [enabled])

  if (!enabled || captions.length === 0) return null

  return (
    <div className="hud-subtitles" role="log" aria-live="polite">
      {captions.map((c) => (
        <p key={c.id} className="hud-subtitles__line">
          {c.text}
        </p>
      ))}
    </div>
  )
}
