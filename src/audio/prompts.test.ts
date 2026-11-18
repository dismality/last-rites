// The audio prompt sheet (tools/audio/prompts.mjs) against the game: narration must say exactly
// what the cards say, names must be unique, and every sound marked as played must be one the
// game really asks for.
import { describe, expect, it } from 'vitest'
import { AUDIO, fileNames, inBatch } from '../../tools/audio/prompts.mjs'
import { AUTUMN_SOUNDS } from '../data/allHallows'
import { INTRO_SHOTS } from '../data/introCutscene'
import { JOURNAL_PAGES } from '../data/journal'
import { ENDINGS } from '../data/endings'
import { WIN_SEQUENCE } from '../data/winCutscene'
import { SOUND_IDS } from '../data/sounds'
import { CAPTIONS } from '../data/captions'
import { sampleName } from './sampleManifest'

const byName = new Map(AUDIO.map((e) => [e.name, e]))

describe('audio prompt sheet', () => {
  it('has unique names that the loader accepts', () => {
    const files = AUDIO.flatMap((e) => fileNames(e).map((n) => `${e.folder}/${n}`))
    expect(new Set(files).size).toBe(files.length)
    for (const f of files) expect(sampleName(`${f}.ogg`), f).not.toBeNull()
  })

  it('reads the intro cards word for word, one line per shot', () => {
    INTRO_SHOTS.forEach((shot, i) => {
      expect(byName.get(`intro-${i + 1}`)?.text).toBe(shot.card.text)
    })
  })

  it('reads the journal pages, endings and walk-out word for word', () => {
    for (const e of AUDIO.filter((a) => a.source)) {
      const [kind, a, b] = e.source!.split(':')
      const expected =
        kind === 'page'
          ? JOURNAL_PAGES.find((p) => p.id === Number(a))?.text
          : kind === 'ending'
            ? ENDINGS.find((d) => d.id === a)?.lines[Number(b)]?.text
            : WIN_SEQUENCE.lines[Number(a)]?.text
      expect(e.text, e.name).toBe(expected)
    }
  })

  it('marks as played only sounds the game asks for', () => {
    const asked = new Set<string>([
      ...SOUND_IDS,
      ...CAPTIONS.map((c) => c.event as string),
      'zombie-groan', 'step-grass', 'step-stone', 'step-wood', 'stair-footsteps', 'rain',
      'crafting-tick', 'crafting-complete', 'crafting-cancel', 'satchel-open', 'satchel-close',
      'page-turn', 'heartbeat', 'throw', 'flask-shatter', 'bomb-fuse', 'bomb-blast', 'trap-spring', 'salt-place',
      'stone-grind', 'wind-gust', 'door-creak', 'door-slam', 'soil-crumble', 'hand-grab', 'whisper-keeper', 'breath-behind',
      'bloater-gurgle', 'lurker-breath', 'wailer-wail', 'crane-censer',
      ...Object.values(AUTUMN_SOUNDS),
      ...INTRO_SHOTS.map((_, i) => `intro-${i + 1}`),
    ])
    for (const e of AUDIO.filter((a) => a.wired)) expect(asked.has(e.name), e.name).toBe(true)
  })

  it('has a halloween batch with the wind, three crows and the bell', () => {
    const n = AUDIO.filter((e) => inBatch(e, 'halloween')).flatMap(fileNames)
    expect(n.sort()).toEqual(['bell-all-souls', 'crow-caw-1', 'crow-caw-2', 'crow-caw-3', 'wind-night'])
  })

  it('has a first batch of about fifteen files', () => {
    const n = AUDIO.filter((e) => inBatch(e, 'first')).flatMap(fileNames).length
    expect(n).toBe(15)
  })
})
