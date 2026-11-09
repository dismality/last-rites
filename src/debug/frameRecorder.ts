// Rolling frame-time recorder: one requestAnimationFrame loop, keeps the last `keepMs` of frames.

export interface FrameRecorder {
  /** Longest frame (ms) among frames that ended within the last `windowMs`; 0 when none. */
  longest: (windowMs?: number) => number
  reset: () => void
}

interface Sample {
  at: number
  ms: number
}

/** Pure part, kept separate so it is unit-testable without a browser. */
export function createFrameBuffer(keepMs: number) {
  let samples: Sample[] = []
  return {
    push(at: number, ms: number): void {
      samples.push({ at, ms })
      const cutoff = at - keepMs
      let drop = 0
      while (drop < samples.length && samples[drop].at < cutoff) drop++
      if (drop > 0) samples = samples.slice(drop)
    },
    longest(now: number, windowMs: number = keepMs): number {
      let worst = 0
      for (const s of samples) if (s.at >= now - windowMs && s.ms > worst) worst = s.ms
      return worst
    },
    reset(): void {
      samples = []
    },
  }
}

export function installFrameRecorder(keepMs: number): FrameRecorder {
  const buf = createFrameBuffer(keepMs)
  let last = performance.now()
  const loop = (now: number) => {
    buf.push(now, now - last)
    last = now
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
  return {
    longest: (windowMs) => buf.longest(performance.now(), windowMs),
    reset: () => buf.reset(),
  }
}
