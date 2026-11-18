import { describe, expect, it } from 'vitest'
import { liveSubsections, parseHorrorPass, parseTables, readHorrorPass, subsection, tableOf } from './helpers/designBible'
import { VENDING_FORBIDDEN, VENDING_RANGE_M, VENDING_ROWS } from '../src/data/vending'
import { EFFECT_MAP } from '../src/data/effects'
import { BAT } from '../src/data/bats'
import { HINT_COSTS } from '../src/data/cases'
import { INFO_TIPS, INFO_TIP_KEYS } from '../src/data/infoTips'
import {
  SCARE_SETS,
  SCREEN_SCARE_COOLDOWN_S,
  SCREEN_SCARE_HEIGHT_VH,
  SCREEN_SCARE_HOLD_MAX_MS,
  SCREEN_SCARE_HOLD_MIN_MS,
  SCREEN_SCARE_IN_MS,
  SCREEN_SCARE_MAJOR_GAP_S,
  SCREEN_SCARE_OFF_SUBTITLE_S,
  SCREEN_SCARE_OUT_MS,
  SCREEN_SCARE_SCALE_MAX,
  SCREEN_SCARE_SCALE_MIN,
  SCREEN_SCARE_TELEGRAPH_MAX_MS,
  SCREEN_SCARE_TELEGRAPH_MIN_MS,
  SCRIPTED_MOMENTS,
  TRIGGER_SETS,
} from '../src/data/screenScares'
import { scareFaceUrl } from '../src/data/assets'

// Spec 11 task 1.2 (Req 8.2, 8.3): the horror-pass section of the design bible ("§12" in spec 11,
// "## 14. Horror pass" in the bible) has its nine subsections, and a small parser hands later tasks
// typed table rows to compare with `src/data/`. Each feature task adds its own table-versus-data
// check to this file; a subsection marked cut is skipped.

const bible = readHorrorPass()

describe('the horror pass in the design bible', () => {
  it('has subsections 1 to 9, in order', () => {
    expect(bible.subsections.map((s) => s.number)).toEqual(
      Array.from({ length: 9 }, (_, i) => `${bible.sectionNumber}.${i + 1}`),
    )
  })

  it('names the subsections of the spec 11 design', () => {
    const titles = bible.subsections.map((s) => s.title.replace(/\s*\(.*\)\s*$/, ''))
    expect(titles).toEqual([
      'Screen jumpscares',
      'New creatures',
      'Zombie looks',
      'Bats',
      'Info dots',
      'Vending machine',
      'Hands and lantern light',
      'Settings and controls',
      'Cut list',
    ])
  })

  it('gives every live subsection at least one table with rows', () => {
    for (const s of liveSubsections(bible)) {
      expect(s.tables.length, s.number).toBeGreaterThan(0)
      for (const t of s.tables) expect(t.rows.length, `${s.number} ${t.header[0]}`).toBeGreaterThan(0)
    }
  })

  it('accepts a spec 11 number or a bible number for a subsection', () => {
    expect(subsection(bible, '12.6')).toBe(subsection(bible, `${bible.sectionNumber}.6`))
  })

  it('keeps the cut list in priority order and in step with the cut marks', () => {
    const cuts = tableOf(subsection(bible, '12.9'), 'Priority').rows
    expect(cuts.map((r) => Number(r.Priority))).toEqual([1, 2, 3, 4, 5, 6])
    for (const row of cuts) {
      expect(['Planned', 'Built', 'cut'], row.Feature).toContain(row.Status)
      for (const n of row.Subsection.split(',').map((x) => x.trim())) {
        const s = bible.subsections.find((x) => x.number === n)
        expect(s, n).toBeDefined()
        expect(s!.cut, `${n} cut mark matches the cut list`).toBe(row.Status === 'cut')
      }
    }
    // Lowest priority goes first: a cut row never sits above a row that is not cut.
    const firstCut = cuts.findIndex((r) => r.Status === 'cut')
    if (firstCut >= 0) expect(cuts.slice(firstCut).every((r) => r.Status === 'cut')).toBe(true)
  })

  it('reads the vending rows as typed records', () => {
    const rows = tableOf(subsection(bible, '12.6'), 'Row').rows
    expect(rows).toHaveLength(6)
    expect(rows[0]).toMatchObject({ ID: '`revolver-cartridge`', Qty: '6', Price: '12', 'Per day': '2' })
  })
})

// Spec 11 task 2.2 (Req 6.3, 8.2): §12.6 (bible §14.6) against src/data/vending.ts, row by row.
describe('§12.6 vending machine mirrors src/data/vending.ts', () => {
  const s = subsection(bible, '12.6')
  const unticked = (v: string): string => v.replace(/`/g, '')

  it.skipIf(s.cut)('has the same six rows in the same order', () => {
    const rows = tableOf(s, 'Row').rows
    expect(rows.map((r) => unticked(r.ID))).toEqual(VENDING_ROWS.map((r) => r.id))
    rows.forEach((r, i) => {
      const d = VENDING_ROWS[i]
      expect(Number(r.Row), d.id).toBe(i)
      expect(r.Item, d.id).toBe(d.name)
      expect(Number(r.Qty), d.id).toBe(d.qty)
      expect(Number(r.Price), d.id).toBe(d.price)
      expect(Number(r['Per day']), d.id).toBe(d.perDay)
      expect(r.Needs === '—' ? undefined : r.Needs.toLowerCase(), d.id).toBe(d.requiresWeapon)
      expect(unticked(r.Handle).startsWith(`handle-${d.handle}`), d.id).toBe(true)
    })
  })

  it.skipIf(s.cut)('names the forbidden goods, the range and the Brisk Draught numbers', () => {
    expect(s.body).toMatch(/Never stocked:\*\* relics, key items, journal pages, recipes, clues, holy water, silver filings/)
    for (const id of ['holy-water', 'silver-filings']) expect(VENDING_FORBIDDEN).toContain(id)
    expect(s.body).toContain(`within ${VENDING_RANGE_M} m`)
    expect(s.body).toContain('+25% move speed for 60 s')
    expect(EFFECT_MAP['brisk-draught']).toMatchObject({ durationS: 60, mods: { moveSpeed: 1.25 } })
  })
})

// Spec 11 task 3.1 (Req 1.1, 1.2, 1.16, 8.2): §12.1 (bible §14.1) against src/data/screenScares.ts.
describe('§12.1 screen jumpscares mirror src/data/screenScares.ts', () => {
  const s = subsection(bible, '12.1')
  const unticked = (v: string): string => v.replace(/`/g, '')
  const timing = (name: string): string => tableOf(s, 'Timing').rows.find((r) => r.Timing === name)!.Value

  it.skipIf(s.cut)('has the same five faces, sets, edges and paths', () => {
    const rows = tableOf(s, 'Face').rows
    const data = Object.values(SCARE_SETS).flatMap((set) => set.faces.map((f) => ({ f, set })))
    expect(rows.map((r) => unticked(r.Face))).toEqual(data.map((d) => d.f))
    rows.forEach((r, i) => {
      expect(r.Set, data[i].f).toBe(data[i].set.id)
      expect(r.Edge.toLowerCase(), data[i].f).toBe(data[i].set.edge)
      expect(unticked(r.Path), data[i].f).toBe(`public${scareFaceUrl(data[i].f)}`)
    })
  })

  it.skipIf(s.cut)('has the same timings', () => {
    expect(timing('Image height')).toBe(`${SCREEN_SCARE_HEIGHT_VH}% of the viewport height`)
    expect(timing('In')).toBe(`${SCREEN_SCARE_IN_MS} ms, no easing`)
    expect(timing('Hold')).toBe(`${SCREEN_SCARE_HOLD_MIN_MS} to ${SCREEN_SCARE_HOLD_MAX_MS} ms (random)`)
    expect(timing('Out')).toMatch(new RegExp(`^${SCREEN_SCARE_OUT_MS} ms`))
    expect(timing('Telegraph lead')).toMatch(
      new RegExp(`^${SCREEN_SCARE_TELEGRAPH_MIN_MS} to ${SCREEN_SCARE_TELEGRAPH_MAX_MS} ms`),
    )
    expect(timing('Cooldown')).toMatch(new RegExp(`^${SCREEN_SCARE_COOLDOWN_S} s`))
    expect(timing('Major-scare gap')).toMatch(new RegExp(`^${SCREEN_SCARE_MAJOR_GAP_S} s`))
    expect(timing('Scale jitter')).toBe(`${SCREEN_SCARE_SCALE_MIN.toFixed(2)} to ${SCREEN_SCARE_SCALE_MAX.toFixed(2)}`)
    expect(timing('Off subtitle')).toBe(`${SCREEN_SCARE_OFF_SUBTITLE_S} s`)
  })

  it.skipIf(s.cut)('has the same five triggers and their sets', () => {
    const rows = tableOf(s, 'Trigger').rows
    expect(rows.map((r) => unticked(r.Trigger))).toEqual(Object.keys(TRIGGER_SETS))
    for (const r of rows) expect(r.Set, r.Trigger).toBe(TRIGGER_SETS[unticked(r.Trigger) as keyof typeof TRIGGER_SETS])
  })

  it.skipIf(s.cut)('has the three scripted moments, once per save', () => {
    expect(SCRIPTED_MOMENTS.map((m) => m.id)).toEqual(['coffin-night-2', 'hut-window-night-3', 'ossuary-grille'])
    for (const m of SCRIPTED_MOMENTS) {
      expect(m.set, m.id).toBe(TRIGGER_SETS[m.id])
      const row = tableOf(s, 'Trigger').rows.find((r) => unticked(r.Trigger) === m.id)!
      expect(row['Gameplay effect'], m.id).toMatch(/Once per save/)
    }
  })
})

// Spec 11 task 4.1 (Req 4.1, 4.3, 4.6 to 4.9, 4.12, 8.2): §12.4 (bible §14.4) against src/data/bats.ts.
describe('§12.4 bats mirror src/data/bats.ts', () => {
  const s = subsection(bible, '12.4')
  const value = (name: string): string => tableOf(s, 'Bats').rows.find((r) => r.Bats === name)!.Value
  const nums = (v: string): number[] => (v.match(/\d+(?:\.\d+)?/g) ?? []).map(Number)

  it.skipIf(s.cut)('has the same counts, heights, ranges and angles', () => {
    expect(nums(value('Perched per night')).slice(0, 2)).toEqual([BAT.perchedMin, BAT.perchedMax])
    expect(nums(value('Perch boxes')).slice(0, 2)).toEqual([BAT.boxHeightMinM, BAT.boxHeightMaxM])
    expect(nums(value('Watch range'))[0]).toBe(BAT.watchRangeM)
    expect(nums(value('Turn limit'))[0]).toBe(BAT.maxYawDeg)
  })

  it.skipIf(s.cut)('has the same timings', () => {
    expect(nums(value('Ease time constant'))[0]).toBe(BAT.easeS)
    expect(nums(value('Ease time constant'))[1]).toBe(BAT.restWithinS)
    expect(nums(value('Take-off')).slice(0, 2)).toEqual([BAT.takeoffM, BAT.gunRangeM])
    expect(nums(value('Flaps'))[0]).toBe(BAT.flapsPerS)
    expect(nums(value('Flight')).slice(0, 2)).toEqual([BAT.flightS, BAT.fadeS])
    expect(nums(value('Return'))[0]).toBe(BAT.returnS)
    expect(nums(value('Chitter'))[0]).toBe(BAT.chitterGapS)
  })

  it.skipIf(s.cut)('has the same belfry flock', () => {
    const f = BAT.belfryFlock
    expect(nums(value('Belfry flock (optional)')).slice(0, 2)).toEqual([f.min, f.max])
    expect(nums(value('Belfry flock (optional)'))[2]).toBe(f.maxS)
    expect(nums(value('Belfry flock (optional)'))[3]).toBe(f.frameBudgetMs)
  })
})

// Spec 11 task 5.1 (Req 5.1, 5.7, 5.8, 5.11, 8.2): §12.5 (bible §14.5) against src/data/infoTips.ts.
describe('§12.5 info dots mirror src/data/infoTips.ts', () => {
  const s = subsection(bible, '12.5')
  const unticked = (v: string): string => v.replace(/`/g, '')

  it.skipIf(s.cut)('lists the same keys in the same order', () => {
    const keys = tableOf(s, 'Key').rows.map((r) => unticked(r.Key))
    expect(keys).toEqual([...INFO_TIP_KEYS])
  })

  it.skipIf(s.cut)('gives every key a tip of at most 2 sentences', () => {
    for (const key of INFO_TIP_KEYS) {
      const tip = INFO_TIPS[key]
      expect(tip.length, key).toBeGreaterThan(0)
      const sentences = tip.split(/[.!?](?:\s+|$)/).filter((x) => x.trim() !== '')
      expect(sentences.length, key).toBeLessThanOrEqual(2)
    }
  })

  it.skipIf(s.cut)('states the hint prices and the vending machine', () => {
    expect(INFO_TIPS['hud-hints']).toContain(`${HINT_COSTS[0]}, then ${HINT_COSTS[1]}, then ${HINT_COSTS[2]}`)
    expect(INFO_TIPS['hud-coins']).toMatch(/vending machine/i)
  })
})

describe('the parser', () => {
  const fixture = [
    '## 2. Other',
    '### 2.1 Not this (11)',
    '| A | B |',
    '|---|---|',
    '| x | y |',
    '',
    '## 7. Horror pass (11)',
    'Intro.',
    '### 7.1 Faces (11, H1)',
    '| Face | Edge |',
    '|---|---|',
    '| `a` | Bottom |',
    '| `b` | Top |',
    '',
    'Text between tables.',
    '',
    '| Timing | Value |',
    '| --- | --- |',
    '| In | 70 ms |',
    '### Unnumbered note',
    '| Ignored | Table |',
    '|---|---|',
    '| 1 | 2 |',
    '### 7.2 Bats (11, H4, cut)',
    '| Bats | Value |',
    '|---|---|',
    '| Range | 14 m |',
    '## 8. After',
    '### 8.1 Not this either',
  ].join('\n')

  it('finds the section by its title, whatever its number', () => {
    const h = parseHorrorPass(fixture)
    expect(h.sectionNumber).toBe(7)
    expect(h.subsections.map((s) => s.number)).toEqual(['7.1', '7.2'])
  })

  it('returns every table of a subsection as typed rows, stopping at an unnumbered heading', () => {
    const s = parseHorrorPass(fixture).subsections[0]
    expect(s.tables).toHaveLength(2)
    expect(s.tables[0].rows).toEqual([
      { Face: '`a`', Edge: 'Bottom' },
      { Face: '`b`', Edge: 'Top' },
    ])
    expect(s.tables[1].rows).toEqual([{ Timing: 'In', Value: '70 ms' }])
  })

  it('skips a subsection marked cut', () => {
    const h = parseHorrorPass(fixture)
    expect(h.subsections[1].cut).toBe(true)
    expect(liveSubsections(h).map((s) => s.number)).toEqual(['7.1'])
  })

  it('does not take "Cut list" for a cut mark', () => {
    expect(parseHorrorPass('## 3. Horror pass\n### 3.9 Cut list (11)\n| A |\n|---|\n| 1 |').subsections[0].cut).toBe(false)
  })

  it('names a malformed row', () => {
    expect(() => parseTables('| A | B |\n|---|---|\n| only one |')).toThrow(/only one/)
  })

  it('says so when there is no horror pass', () => {
    expect(() => parseHorrorPass('## 1. Story')).toThrow(/Horror pass/)
  })
})
