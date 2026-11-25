// The recordings that read the keeper's lines aloud (public/assets/audio/voice/<name>.ogg, made
// from tools/audio/prompts.mjs, batch "keeper"). Names follow each line's place in the case's
// narration data, so they stay put when a line's words change. Pure data.

import { CASE1_SAY } from './case1Narration'
import { CASE2_SAY } from './case2Narration'
import { CASE3_SAY } from './case3Narration'
import type { LedgerFlagKind } from './cases'

/** "ledgerRight" -> "ledger-right"; a bell post id drops its "bell-" ("bell-ames" -> "ames"). */
const slug = (key: string): string => key.replace(/^bell-/, '').replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)

function walkLines(prefix: string, say: Record<string, unknown>): { name: string; text: string }[] {
  const out: { name: string; text: string }[] = []
  const walk = (name: string, v: unknown): void => {
    if (typeof v === 'string') {
      if (v !== '') out.push({ name, text: v })
    } else if (typeof v === 'function') {
      for (const kind of ['date', 'plot', 'cause'] as const) walk(`${name}-${kind}`, (v as (k: LedgerFlagKind) => string)(kind))
    } else if (Array.isArray(v)) {
      v.forEach((line, i) => walk(v.length > 1 ? `${name}-${i + 1}` : name, line))
    } else if (v && typeof v === 'object') {
      for (const [k, sub] of Object.entries(v)) walk(`${name}-${slug(k)}`, sub)
    }
  }
  for (const [k, v] of Object.entries(say)) walk(`${prefix}-${slug(k)}`, v)
  return out
}

/** Every line the keeper can say, each with the recording that reads it: Case 1, 2, then 3. */
export function keeperVoiceLines(): { name: string; text: string }[] {
  return [...walkLines('keeper', CASE1_SAY), ...walkLines('keeper2', CASE2_SAY), ...walkLines('keeper3', CASE3_SAY)]
}

const VOICE_BY_TEXT = new Map(keeperVoiceLines().map((l) => [l.text, l.name]))

/** The recording that reads this line, or null for a line with none. */
export const keeperVoiceFor = (text: string): string | null => VOICE_BY_TEXT.get(text) ?? null
