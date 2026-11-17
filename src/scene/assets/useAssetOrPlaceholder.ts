// Asks whether an art file is really there before anything loads it, so a missing spec 11 file
// never reaches useGLTF (which would throw into Suspense). A missing or failed file is registered
// once in the Waiting_List and the caller draws its marked placeholder (design bible §14).
//
// The probe is a HEAD request. A dev server or host that answers a missing file with the app's
// index.html (status 200, text/html) counts as missing too.

import { useEffect, useState } from 'react'
import { registerMissingArt } from '../../game/state/waitingList'

export type AssetStatus = 'checking' | 'present' | 'missing'

const probes = new Map<string, Promise<boolean>>()
const known = new Map<string, boolean>()

function probe(url: string): Promise<boolean> {
  let p = probes.get(url)
  if (!p) {
    p = fetch(url, { method: 'HEAD' })
      .then((r) => r.ok && !(r.headers.get('content-type') ?? '').includes('text/html'))
      .catch(() => false)
      .then((ok) => {
        known.set(url, ok)
        if (!ok) registerMissingArt(url)
        return ok
      })
    probes.set(url, p)
  }
  return p
}

/** The file's state: 'checking' until the probe answers, then 'present' or 'missing'. */
export function useAssetOrPlaceholder(url: string): AssetStatus {
  // The cache answers at once for a file already probed; otherwise the probe's answer re-renders.
  const [, setAnswered] = useState(0)
  useEffect(() => {
    if (known.has(url)) return
    let live = true
    void probe(url).then(() => live && setAnswered((n) => n + 1))
    return () => {
      live = false
    }
  }, [url])
  const ok = known.get(url)
  return ok === undefined ? 'checking' : ok ? 'present' : 'missing'
}
