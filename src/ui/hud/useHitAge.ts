import { useEffect, useState } from 'react'
import { useUiWorldStore } from '../../game/state/uiWorldStore'
import { HIT_FEEDBACK_MS } from '../../game/systems/damageFeedback'

/**
 * Milliseconds since the player was last hit, re-rendering each frame only
 * while the feedback window is open. Returns Infinity when idle.
 */
export function useHitAge(): number {
  const lastDamageAt = useUiWorldStore((s) => s.lastDamageAt)
  const [age, setAge] = useState(Infinity)

  useEffect(() => {
    if (lastDamageAt === 0) return
    let raf = 0
    const step = () => {
      const a = Date.now() - lastDamageAt
      if (a >= HIT_FEEDBACK_MS) {
        setAge(Infinity)
        return
      }
      setAge(a)
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [lastDamageAt])

  return age
}
