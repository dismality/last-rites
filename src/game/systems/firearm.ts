// Magazine and reload rules for firearms (Req 3.1, 3.8-3.10, 4). Pure: the satchel stack is
// passed in and the rounds moved are returned, so the caller owns the inventory write.

export interface FirearmState {
  magazine: number
  /** Seconds of reload left, or null when not reloading. */
  reloadLeftS: number | null
  /** Seconds since the last shot; starts large so the first pull is never blocked. */
  sinceShotS: number
}

/** The stats this module needs; upgrades can supply modified values. */
export interface FirearmStats {
  capacity: number
  reloadS: number
  fireIntervalS: number
}

export type TriggerOutcome = 'fired' | 'dry' | 'cooldown' | 'reloading'

export function pullTrigger(
  s: FirearmState,
  st: FirearmStats,
): { state: FirearmState; outcome: TriggerOutcome } {
  if (s.reloadLeftS !== null) return { state: s, outcome: 'reloading' }
  if (s.magazine <= 0) return { state: s, outcome: 'dry' }
  if (s.sinceShotS < st.fireIntervalS) return { state: s, outcome: 'cooldown' }
  return { state: { ...s, magazine: s.magazine - 1, sinceShotS: 0 }, outcome: 'fired' }
}

export function canReload(s: FirearmState, st: FirearmStats, ammoInStack: number): boolean {
  return s.reloadLeftS === null && s.magazine < st.capacity && ammoInStack >= 1
}

export function startReload(s: FirearmState, st: FirearmStats, ammoInStack: number): FirearmState {
  if (!canReload(s, st, ammoInStack)) return s
  return { ...s, reloadLeftS: st.reloadS }
}

export function tickFirearm(s: FirearmState, dt: number): FirearmState {
  if (!(dt > 0)) return s
  return {
    ...s,
    sinceShotS: s.sinceShotS + dt,
    reloadLeftS: s.reloadLeftS === null ? null : Math.max(0, s.reloadLeftS - dt),
  }
}

export function reloadReady(s: FirearmState): boolean {
  return s.reloadLeftS !== null && s.reloadLeftS <= 0
}

/** Moves min(missing, stack) rounds into the magazine. Does nothing unless a reload is running. */
export function completeReload(
  s: FirearmState,
  st: FirearmStats,
  ammoInStack: number,
): { state: FirearmState; ammoUsed: number } {
  if (s.reloadLeftS === null) return { state: s, ammoUsed: 0 }
  const missing = Math.max(0, st.capacity - s.magazine)
  const ammoUsed = Math.max(0, Math.min(missing, ammoInStack))
  return {
    state: { ...s, magazine: s.magazine + ammoUsed, reloadLeftS: null },
    ammoUsed,
  }
}

export function cancelReload(s: FirearmState): FirearmState {
  return s.reloadLeftS === null ? s : { ...s, reloadLeftS: null }
}
