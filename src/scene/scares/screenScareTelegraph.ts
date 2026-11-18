// Telegraph for a queued screen scare (spec 11 H1, Req 1.18): the lantern flickers (a steady dip
// with Flashing lights off, handled by the Lantern) for the whole lead, so the face never arrives
// unannounced. Reuses the breath-behind flicker channel of the scare director.
import { useSettingsStore } from '../../game/state/settingsStore'
import type { PendingScare } from '../../game/systems/screenScareQueue'
import { scareRuntime } from './scareRuntime'

export function playScareTelegraph(p: PendingScare): void {
  scareRuntime.flickerLeft = Math.max(scareRuntime.flickerLeft, p.fireAt - p.telegraphAt + 0.1)
  scareRuntime.flickerStrobe = useSettingsStore.getState().flashingLights
}
