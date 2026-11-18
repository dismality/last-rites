import { describe, expect, it } from 'vitest'
import { liveSubsections, parseHorrorPass, parseTables, readHorrorPass, subsection, tableOf } from './helpers/designBible'
import { VENDING_FORBIDDEN, VENDING_RANGE_M, VENDING_ROWS } from '../src/data/vending'
import { EFFECT_MAP } from '../src/data/effects'
import { BAT } from '../src/data/bats'
import { COMMON_CLIPS, CUE_SUBTITLES, ENEMY_LOOKS, ENEMY_MAP, MOVEMENT_CLIP, expectedClips } from '../src/data/enemies'
import { BRIDE, CRAWLER, CREATURE_SOUNDS, CREATURE_TELL_S, HOUND, BESTIARY_SEEN_RADIUS_M } from '../src/data/creatures'
import { BESTIARY, FIELD_NOTE_MAX } from '../src/data/bestiary'
import { CAPTION_MAP, type CaptionId } from '../src/data/captions'
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
import {
  BRIDE_MODEL_URL,
  BRUTE_MODEL_URL,
  CRAWLER_MODEL_URL,
  HOUND_MODEL_URL,
  ZOMBIE_MODEL_URL,
  scareFaceUrl,
} from '../src/data/assets'
import { LANTERN_HOOK_CAPTION, LANTERN_LIGHT } from '../src/data/lanternLight'
import { GRIP_TABLE, HANDS_CLIPS, VIEWMODEL_TIMING, type GripWeaponId } from '../src/data/viewmodel'

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

// Spec 11 task 6.1 (Req 7.1, 7.2, 7.5, 7.9, 7.11 to 7.14, 8.2): §12.7 (bible §14.7) against
// src/data/lanternLight.ts and src/data/viewmodel.ts.
describe('§12.7 hands and lantern light mirror the data', () => {
  const s = subsection(bible, '12.7')
  const unticked = (v: string): string => v.replace(/`/g, '')
  const nums = (v: string): number[] => (v.match(/\d+(?:\.\d+)?/g) ?? []).map(Number)
  const hands = (name: string): string => tableOf(s, 'Hands').rows.find((r) => r.Hands === name)!.Value
  const light = (name: string): string => tableOf(s, 'Light').rows.find((r) => r.Light === name)!.Value

  it.skipIf(s.cut)('has the same grip table', () => {
    const rows = tableOf(s, 'Weapon').rows
    expect(rows.map((r) => unticked(r.Weapon))).toEqual(Object.keys(GRIP_TABLE))
    for (const r of rows) expect(r.Grip.toLowerCase(), r.Weapon).toBe(GRIP_TABLE[unticked(r.Weapon) as GripWeaponId])
  })

  it.skipIf(s.cut)('names the clips of the hands model', () => {
    for (const clip of Object.values(HANDS_CLIPS)) expect(s.body, clip).toContain(clip)
  })

  it.skipIf(s.cut)('has the same hand timings', () => {
    expect(nums(hands('Grip switch'))[0]).toBe(VIEWMODEL_TIMING.gripBlendS)
    expect(nums(hands('Lantern sway lag'))[0]).toBe(VIEWMODEL_TIMING.swayLagS * 1000)
    expect(nums(hands('Lantern sway lag'))[1]).toBe(VIEWMODEL_TIMING.swayLagToleranceS * 1000)
    expect(nums(hands('Sprint drop')).slice(0, 2)).toEqual([...VIEWMODEL_TIMING.sprintDropM])
    expect(nums(hands('Shotgun'))).toEqual(expect.arrayContaining([...VIEWMODEL_TIMING.beltLightDownDeg, VIEWMODEL_TIMING.beltReturnS]))
    expect(nums(hands('Throw or heavy swing (axe, sabre)')).pop()).toBe(VIEWMODEL_TIMING.strapCatchS)
    expect(hands('Belt caption')).toContain(`"${LANTERN_HOOK_CAPTION}"`)
  })

  it.skipIf(s.cut)('has the same light numbers', () => {
    const L = LANTERN_LIGHT
    expect(light('Spot')).toContain(`shadow map ${L.shadowMap}`)
    expect(nums(light('Fill'))[0]).toBe(L.fillRadius)
    expect(light('Colour')).toContain(L.color)
    expect(light('Colour')).toContain(L.lowOilColor)
    expect(nums(light('Colour'))).toContain(L.lowOilBelow)
    expect(nums(light('Breathing')).slice(0, 2)).toEqual([...L.breathHz])
    expect(nums(light('Gutters')).slice(0, 2)).toEqual([...L.gutterHz])
    expect(nums(light('Dips'))[0]).toBe(L.dipMax * 100)
    expect(nums(light('Low oil (below 15%)'))[0]).toBe(L.lowOilGutterMult)
    expect(nums(light('Sprint or gust'))[0]).toBe(L.moveGutterMult)
    expect(nums(light('Oil at 0'))[0]).toBe(L.flareS)
    expect(nums(light('Bride within 8 m'))[0]).toBe(1 - L.brideDim)
    expect(nums(light('Flashing lights off'))).toEqual([L.flashingOffMaxHz, L.flashingOffMaxStep * 100])
  })
})

// Spec 11 task 7.1 (Req 2.1, 2.14, 2.15, 2.18, 3.7, 8.2): §12.2 (bible §14.2) against
// src/data/enemies.ts, creatures.ts and bestiary.ts.
describe('§12.2 new creatures mirror the data', () => {
  const s = subsection(bible, '12.2')
  const unticked = (v: string): string => v.replace(/`/g, '')
  const nums = (v: string): number[] => (v.match(/\d+(?:\.\d+)?/g) ?? []).map(Number)
  const trait = (name: string): string => tableOf(s, 'Trait').rows.find((r) => r.Trait === name)!.Value
  const ids = ['crawler', 'bride', 'hound'] as const

  it.skipIf(s.cut)('has the same enemy rows', () => {
    const rows = tableOf(s, 'ID').rows
    expect(rows.map((r) => unticked(r.ID))).toEqual([...ids])
    for (const r of rows) {
      const d = ENEMY_MAP[unticked(r.ID) as (typeof ids)[number]]
      expect(r.Name, d.id).toBe(d.name)
      expect(Number(r.HP), d.id).toBe(d.hp)
      expect(nums(r.Speed)[0], d.id).toBe(d.speed)
      expect(nums(r.Damage)[0], d.id).toBe(d.damage)
    }
    // The bride never joins waves or elites; the type system keeps her out of WaveEnemyId.
    const bride = tableOf(s, 'ID').rows.find((r) => unticked(r.ID) === 'bride')!
    expect([bride.Waves, bride.Elites]).toEqual(['Never', 'Never'])
  })

  it.skipIf(s.cut)('has four looks per new id', () => {
    for (const id of ids) expect(ENEMY_LOOKS[id].variants, id).toHaveLength(4)
  })

  it.skipIf(s.cut)('has the same crawler, bride and hound traits', () => {
    expect(nums(trait('Crawler spots per stage 2 night')).slice(0, 2)).toEqual([CRAWLER.spotsMin, CRAWLER.spotsMax])
    expect(nums(trait('Crawler burst range'))[0]).toBe(CRAWLER.burstRangeM)
    expect(nums(trait('Crawler face range'))[0]).toBe(CRAWLER.faceRangeM)
    expect(nums(trait('Crawler grab cooldown'))[0]).toBe(CRAWLER.grabCooldownS)
    expect(Number(tableOf(s, 'ID').rows[0].Damage.match(/\d+/)![0])).toBe(CRAWLER.grabDamage)
    expect(CRAWLER.lungeSpeedMps).toBe(6)
    expect(nums(trait('Bride visible'))[0]).toBe(BRIDE.revealRadiusM)
    expect(nums(trait('Bride oil drain'))[0]).toBe(BRIDE.drainPoints)
    expect(nums(trait('Bride return')).slice(0, 2)).toEqual([BRIDE.respawnMinS, BRIDE.respawnMaxS])
    expect(nums(trait('Bride alive'))[0]).toBe(BRIDE.maxAlive)
    expect(nums(trait('Bride lantern'))[0]).toBe(BRIDE.lanternDimNearM)
    expect(nums(trait('Bride lantern'))).toContain(1 - BRIDE.lanternDim)
    expect(nums(trait('Bride lantern'))).toContain(BRIDE.lanternFadeMinS)
    expect(nums(trait('Hound pack')).slice(0, 2)).toEqual([HOUND.packMin, HOUND.packMax])
    expect(nums(trait('Hound circle')).slice(0, 2)).toEqual([HOUND.circleMinM, HOUND.circleMaxM])
    expect(nums(trait('Hound darts'))[0]).toBe(HOUND.dartGapS)
    expect(nums(trait('Hound scatter')).slice(0, 2)).toEqual([HOUND.scatterRadiusM, HOUND.scatterS])
    expect(nums(trait('Seen (bestiary)'))[0]).toBe(BESTIARY_SEEN_RADIUS_M)
  })

  it.skipIf(s.cut)('has the same tells and captions, 0.5 to 1.5 s ahead', () => {
    expect([CREATURE_TELL_S.min, CREATURE_TELL_S.max]).toEqual([0.5, 1.5])
    for (const r of tableOf(s, 'Creature').rows.filter((x) => x.Tell !== undefined)) {
      const id = unticked(r.Creature) as (typeof ids)[number]
      const cap = CAPTION_MAP[CREATURE_SOUNDS[id].tell as CaptionId]
      expect(r.Caption, id).toBe(cap.text)
      expect(cap.text, id).toBe(CUE_SUBTITLES[ENEMY_MAP[id].audio])
    }
  })

  it.skipIf(s.cut)('has the same bestiary notes', () => {
    const rows = tableOf(s, 'Bestiary').rows
    expect(rows.map((r) => unticked(r.Bestiary))).toEqual(BESTIARY.map((e) => e.id))
    rows.forEach((r, i) => {
      const e = BESTIARY[i]
      expect(r['Field note (at most 200 characters)'], e.id).toBe(e.fieldNote)
      expect(r['What works'], e.id).toBe(e.whatWorks)
      expect(e.fieldNote.length, e.id).toBeLessThanOrEqual(FIELD_NOTE_MAX)
      expect(e.whatWorks.length, e.id).toBeGreaterThan(0)
    })
  })
})

// Spec 11 task 8.1 (Req 3.1, 3.2, 3.5, 3.7, 8.2): §12.3 (bible §14.3) against src/data/assets.ts and enemies.ts.
describe('§12.3 zombie looks mirror the data', () => {
  const s = subsection(bible, '12.3')
  const row = (name: string): string => tableOf(s, 'Contract').rows.find((r) => r.Contract === name)!.Value
  const ticked = (v: string): string[] => [...v.matchAll(/`([^`]+)`/g)].map((m) => m[1])

  it.skipIf(s.cut)('names the five model files, the paths of assets.ts', () => {
    const files = [ZOMBIE_MODEL_URL, BRUTE_MODEL_URL, CRAWLER_MODEL_URL, BRIDE_MODEL_URL, HOUND_MODEL_URL]
    const text = row('Models')
    for (const url of files) {
      expect(url, url).toMatch(/^\/assets\/models\/enemies\/[a-z-]+\.glb$/)
      expect(text, url).toContain(url.split('/').pop()!)
    }
    expect(text).toContain('public/assets/models/enemies/')
    expect(new Set(files).size).toBe(5)
  })

  it.skipIf(s.cut)('has the clip contract: nine clips, the hound and bride with their own movement clip', () => {
    const text = row('Clips')
    for (const c of COMMON_CLIPS) expect(text, c).toContain(c)
    for (const model of ['zombie', 'brute', 'crawler', 'bride', 'hound'] as const) {
      const clips = expectedClips(model)
      expect(clips, model).toHaveLength(9)
      expect(new Set(clips).size, model).toBe(9)
      expect(clips.includes('Crawl'), model).toBe(MOVEMENT_CLIP[model] === 'Crawl')
    }
    expect(MOVEMENT_CLIP.hound).not.toBe('Crawl')
    expect(MOVEMENT_CLIP.bride).not.toBe('Crawl')
    expect(ticked(text)).toEqual(expect.arrayContaining([MOVEMENT_CLIP.hound, MOVEMENT_CLIP.bride]))
  })

  it.skipIf(s.cut)('has four variants per new id, each tint a colour or absent', () => {
    expect(row('Looks per new id')).toMatch(/^4 /)
    for (const id of ['crawler', 'bride', 'hound'] as const) {
      const variants = ENEMY_LOOKS[id].variants!
      expect(variants, id).toHaveLength(4)
      for (const v of variants) if (v.tint !== undefined) expect(v.tint, id).toMatch(/^#[0-9a-f]{6}$/i)
    }
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
