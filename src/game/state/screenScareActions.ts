// Screen jumpscare trigger (spec 11 H1). Gameplay systems and the scripted moments call
// `triggerScreenScare`; the overlay (ui/hud/ScreenScare.tsx) only draws what the store holds.
// Pure zustand glue: no React / three.js / Howler imports.
import { CAPTION_MAP } from '../../data/captions'
import { SCREEN_SCARE_OFF_SUBTITLE_S } from '../../data/screenScares'
import { emit } from '../events'
import {
  requestScreenScare,
  stepScreenScare,
  timelineLengthMs,
  type ScareOutcome,
  type ScareRequest,
  type ScriptedMomentId,
} from '../systems/screenScares'
import { getDevCheats } from './devCheats'
import { isMenuOpen } from './menuState'
import { useScreenScareStore } from './screenScareStore'
import { useSettingsStore } from './settingsStore'
import { simClock } from './simClock'

const prefersReducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Clears the active scare once its timeline has run out. Safe to call every step or frame. */
export function tickScreenScare(): void {
  const { scare, setScare } = useScreenScareStore.getState()
  const next = stepScreenScare(scare, simClock.now)
  if (next !== scare) setScare(next)
}

/** Drops the active scare at once (the overlay calls it when its own clock has run out). */
export function endScreenScare(): void {
  const { scare, setScare } = useScreenScareStore.getState()
  if (scare.active !== null) setScare({ ...scare, active: null })
}

/**
 * Asks for a screen scare. `held` (an overlay is open), `cooldown` and `used` change nothing, so
 * a caller can ask again later and a scripted moment is never marked used by a skip. On `started`
 * the state holds the active scare and its subtitle is out: one line for the whole span at Full
 * and Reduced, a 3 s description at Off, where it is the only cue (Req 1.13, 1.17).
 */
export function triggerScreenScare(kind: ScareRequest['kind'], momentId?: ScriptedMomentId): ScareOutcome {
  tickScreenScare()
  const store = useScreenScareStore.getState()
  const settings = useSettingsStore.getState()
  const req: ScareRequest = { kind, momentId, simTime: simClock.now }
  // Dev only: the flag is false outside the Dev_Panel's "Force screen scare" call.
  const forced = getDevCheats().forceScreenScare
  const { state, outcome } = requestScreenScare(forced ? { ...store.scare, lastStartSim: null } : store.scare, req, {
    overlayOpen: !forced && isMenuOpen(),
    settings,
    prefersReducedMotion: prefersReducedMotion(),
    rng: Math.random,
  })
  if (outcome !== 'started' || state.active === null) return outcome
  store.setScare(state)
  const a = state.active
  if (a.fx.subtitleOnly) {
    const id = a.set === 'zombie-bottom' ? 'screen-scare-off-zombie' : 'screen-scare-off-ghost'
    emit({ type: 'subtitleShown', text: CAPTION_MAP[id].text, duration: SCREEN_SCARE_OFF_SUBTITLE_S, force: true })
  } else {
    emit({
      type: 'subtitleShown',
      text: CAPTION_MAP['screen-scare-sting'].text,
      duration: timelineLengthMs(a.timeline) / 1000,
    })
  }
  return outcome
}
