import { describe, expect, it } from 'vitest'
import { parseCredits } from './credits'

describe('parseCredits', () => {
  it('turns headings into headings and table rows into text, dropping header and divider rows', () => {
    const md = ['# Credits', '', '| Asset | Source |', '| --- | --- |', '| `rain.ogg` | **Freesound** |', '- A plain note'].join('\n')
    expect(parseCredits(md)).toEqual([
      { kind: 'heading', text: 'Credits' },
      { kind: 'text', text: 'rain.ogg, Freesound' },
      { kind: 'text', text: 'A plain note' },
    ])
  })

  it('returns nothing for empty input', () => {
    expect(parseCredits('')).toEqual([])
  })
})
