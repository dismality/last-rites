// Pointer lock request with raw (unadjusted) mouse input where the browser supports it.
// Why: OS pointer acceleration/smoothing makes look feel laggy and uneven. Browsers that don't
// support the option reject (NotSupportedError), throw, or return undefined, so each of those
// falls back to a plain lock. Never throws.

type LockResult = Promise<void> | undefined

/** Plain lock. Returns nothing the caller needs; rejections are swallowed. */
function plainLock(el: Element): void {
  try {
    const r = el.requestPointerLock() as LockResult
    r?.catch?.(() => {})
  } catch {
    /* not allowed right now; the next click tries again */
  }
}

export function requestPointerLockUnadjusted(el: Element): void {
  let result: LockResult
  try {
    result = (el.requestPointerLock as (o?: { unadjustedMovement?: boolean }) => LockResult).call(el, {
      unadjustedMovement: true,
    })
  } catch {
    plainLock(el)
    return
  }
  if (result === undefined || typeof result.then !== 'function') {
    // Older browsers ignore the option and return nothing, so a rejection can't be seen.
    plainLock(el)
    return
  }
  result.then(undefined, () => plainLock(el))
}
