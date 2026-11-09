import { describe, expect, it } from 'vitest'
import { MUSIC } from '../../data/music'
import { SCARE_EVENT_MAP, type ScareEventId } from '../../data/scares'
import { intensityProfile } from '../../game/systems/scareDirector'
import type { ScareCue } from '../../game/systems/scareDirector'
import { emptySilence, isSilent } from '../../game/systems/scareSilence'
import { announceMajor, fireMajor } from './silenceWiring'

function cues(id: ScareEventId, t: number): { tele: ScareCue; beat: ScareCue } {
  const profile = intensityProfile('full', true)
  return {
    tele: { eventId: id, phase: 'telegraph', at: t, intensityProfile: profile },
    beat: { eventId: id, phase: 'beat', at: t + SCARE_EVENT_MAP[id].telegraph.lead, intensityProfile: profile },
  }
}

describe('silenceWiring', () => {
  it('door slam announces at the telegraph, then fires and holds after the beat', () => {
    const { tele, beat } = cues('door-slam', 10)
    const s = announceMajor(emptySilence, tele, [beat], 10, 100)
    expect(s.pending).toHaveLength(1)
    expect(s.pending[0].beatAt).toBeCloseTo(100 + SCARE_EVENT_MAP['door-slam'].telegraph.lead)
    const after = fireMajor(s, beat, 101)
    expect(after.pending).toHaveLength(0)
    expect(isSilent(after, 101 + MUSIC.silenceAfterBeatS - 0.1)).toBe(true)
  })

  it('lurker lunge is silent inside 1.5 s of its beat', () => {
    const { tele, beat } = cues('lurker-lunge', 5)
    const s = announceMajor(emptySilence, tele, [beat], 5, 50)
    const beatAt = s.pending[0].beatAt
    expect(beatAt - 50).toBeCloseTo(SCARE_EVENT_MAP['lurker-lunge'].telegraph.lead)
    expect(isSilent(s, beatAt - MUSIC.silenceBeforeBeatS + 0.01)).toBe(true)
  })

  it('a menu-held (overdue) beat keeps the silence on', () => {
    const { tele, beat } = cues('door-slam', 0)
    const s = announceMajor(emptySilence, tele, [beat], 0, 0)
    expect(isSilent(s, 30)).toBe(true)
  })

  it('ignores minor scares', () => {
    const { tele, beat } = cues('whisper-name', 0)
    expect(announceMajor(emptySilence, tele, [beat], 0, 0)).toBe(emptySilence)
    expect(fireMajor(emptySilence, beat, 1)).toBe(emptySilence)
  })
})
