// Endless Survival: wave generator and best-score rules. Pure TS (design bible §12 "Endless").
// Requirements 7.8, 7.10-7.13, 7.15, 7.16.

import { ENDLESS } from '../../data/modes'
import type { WaveComposition } from '../../data/waves'

const atLeast0 = (n: number): number => Math.max(0, Math.floor(n))

/** Night n (1-based) of Endless: more, and more varied, waves as the nights go on. */
export function endlessNight(n: number): { night: number; waves: WaveComposition[] } {
  const night = Math.max(1, Math.floor(Number.isFinite(n) ? n : 1))
  const count = Math.min(ENDLESS.waveBase + Math.floor(night / 2), ENDLESS.waveCap)
  const wave = (): WaveComposition => ({
    shambler: ENDLESS.shamblerBase + night,
    wailer: atLeast0(night / 2),
    lurker: atLeast0((night - 1) / 2),
    bloater: atLeast0((night - 2) / 2),
    brute: atLeast0((night - 3) / 3),
  })
  return { night, waves: Array.from({ length: count }, wave) }
}

/** Stored best score; anything that is not a finite, non-negative number reads as 0 (Req 7.11). */
export function parseBest(raw: string | null): number {
  if (typeof raw !== 'string') return 0
  const text = raw.trim()
  if (!/^\d+(\.\d+)?$/.test(text)) return 0
  const n = Number(text)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

/** The best only goes up; `write` is true only when the run beat the stored best (Req 7.10). */
export function updateBest(stored: number, runScore: number): { best: number; write: boolean } {
  const s = Number.isFinite(stored) && stored > 0 ? stored : 0
  const r = Number.isFinite(runScore) && runScore > 0 ? runScore : 0
  return r > s ? { best: r, write: true } : { best: s, write: false }
}
