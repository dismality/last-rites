// Pointer lock request with raw (unadjusted) mouse input where the browser supports it.
// Why: OS pointer acceleration/smoothing makes look feel laggy and uneven. Browsers that don't
// support the option reject (NotSupportedError), throw, or return undefined, so each of those
// falls back to a plain lock. Never throws.
//
// Only one request is in flight at a time. Resume, the cursor-release relock and the canvas click
// can all ask in the same frame; Chrome rejects the overlapping ones, and the fallback retries
// then fired a lock change with no lock, which read as "lock lost" and paused the game again.

type LockResult = Promise<void> | undefined

let pending = false

/** A lock request is still waiting for the browser's answer. */
export function lockRequestPending(): boolean {
  return pending
}

/** Test seam: forget an unanswered request. */
export function resetLockRequest(): void {
  pending = false
}

const settle = (): void => {
  pending = false
}

/** Plain lock. Returns nothing the caller needs; rejections are swallowed. */
function plainLock(el: Element): void {
  try {
    const r = el.requestPointerLock() as LockResult
    if (r && typeof r.then === 'function') r.then(settle, settle)
    else settle()
  } catch {
    /* not allowed right now; the next click tries again */
    settle()
  }
}

export function requestPointerLockUnadjusted(el: Element): void {
  if (pending) return
  pending = true
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
  result.then(settle, () => plainLock(el))
}
