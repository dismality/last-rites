import { useEffect } from 'react'
import { playHeartbeat } from '../../audio/AudioManager'
import { usePlayerStore } from '../../game/state/playerStore'
import { useSettingsStore } from '../../game/state/settingsStore'
import { desaturation, heartbeatInterval, vignetteOpacity } from '../../game/systems/damageFeedback'
import { useHitAge } from './useHitAge'

/**
 * Full-screen feedback: red vignette on hit (hidden when flashing lights are
 * off) and a slight desaturation plus heartbeat below 30 HP. The low-health
 * state is also shown by the flame's "!" mark, so colour is not the only cue.
 */
export function DamageFeedback() {
  const health = usePlayerStore((s) => s.health)
  const flashing = useSettingsStore((s) => s.flashingLights)
  const age = useHitAge()

  const interval = heartbeatInterval(health)
  useEffect(() => {
    if (interval === null) return
    playHeartbeat()
    const id = window.setInterval(playHeartbeat, interval * 1000)
    return () => window.clearInterval(id)
  }, [interval])

  const sat = 1 + desaturation(health)
  const opacity = vignetteOpacity(age, flashing)

  return (
    <>
      {sat < 1 && <div className="hud-desat" style={{ backdropFilter: `saturate(${sat})` }} />}
      {opacity > 0 && <div className="hud-hit-vignette" style={{ opacity }} />}
    </>
  )
}
