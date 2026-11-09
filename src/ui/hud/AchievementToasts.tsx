import { useEffect, useState } from 'react'
import { useAchievementStore } from '../../game/state/achievementStore'
import type { AchievementId } from '../../game/types'
import { toastDurationS, toastExpired, toastOpacity } from './achievementToastTiming'
import './AchievementToasts.css'

/** One toast times itself from mount and asks the store to drop it when its time is up. */
function AchievementToast({ id, name }: { id: AchievementId; name: string }) {
  const dismiss = useAchievementStore((s) => s.dismiss)
  const [start] = useState(() => performance.now())
  const [now, setNow] = useState(start)
  const age = (now - start) / 1000
  const expired = toastExpired(age, toastDurationS())

  useEffect(() => {
    const timer = setInterval(() => setNow(performance.now()), 50)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (expired) dismiss(id)
  }, [expired, dismiss, id])

  return (
    <p className="achievement-toast" style={{ opacity: toastOpacity(age, toastDurationS()) }}>
      <span className="achievement-toast__star" aria-hidden="true">
        ★
      </span>
      {name}
    </p>
  )
}

/**
 * Parchment achievement toasts, up to three at once. The store owns the visible/queued split and
 * the toast duration ignores the Subtitles setting, so these always show (Req 8.5).
 */
export function AchievementToasts() {
  const visible = useAchievementStore((s) => s.visible)
  return (
    <div className="achievement-toasts" role="status" aria-live="polite">
      {visible.map((t) => (
        <AchievementToast key={t.id} id={t.id} name={t.name} />
      ))}
    </div>
  )
}
