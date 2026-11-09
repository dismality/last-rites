import { describe, expect, it } from 'vitest'
import { createRunStats, parseStats, statRows } from './runStats'

const label = (rows: { label: string }[]) => rows.map((r) => r.label)

describe('statRows by mode', () => {
  it('hides Father Crane and Relics in Endless but keeps them in story modes', () => {
    const endless = label(statRows(createRunStats(), { score: 0, relics: 0, story: false }))
    expect(endless).not.toContain('Father Crane banished')
    expect(endless).not.toContain('Relics')
    const story = label(statRows(createRunStats(), { score: 0, relics: 0, story: true }))
    expect(story).toContain('Father Crane banished')
    expect(story).toContain('Relics')
    expect(label(statRows(createRunStats(), { score: 0, relics: 0 }))).toContain('Relics')
  })

  it('reads Best combo x1.00 with no combo, in every mode and after sanitising', () => {
    for (const story of [true, false]) {
      const rows = statRows(createRunStats(), { score: 0, relics: 0, story })
      expect(rows.find((r) => r.label === 'Best combo')?.value).toBe('\u00d71.00')
    }
    const saved = parseStats({ bestCombo: 0 })
    const rows = statRows(saved, { score: 0, relics: 0 })
    expect(rows.find((r) => r.label === 'Best combo')?.value).toBe('\u00d71.00')
  })
})
