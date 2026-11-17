import { describe, expect, it } from 'vitest'
import { indexSamples, parseManifest, pickSample, sampleName } from './sampleManifest'

describe('sampleName', () => {
  it('takes the file name inside a known folder', () => {
    expect(sampleName('sfx/revolver-shot.ogg')).toBe('revolver-shot')
    expect(sampleName('voice\\intro-1.ogg')).toBe('intro-1')
    expect(sampleName('ambience/rain.WAV')).toBe('rain')
  })

  it('ignores other folders, nesting and file types', () => {
    expect(sampleName('models/x.ogg')).toBeNull()
    expect(sampleName('sfx/old/x.ogg')).toBeNull()
    expect(sampleName('sfx/notes.txt')).toBeNull()
    expect(sampleName('x.ogg')).toBeNull()
    expect(sampleName('sfx/.ogg')).toBeNull()
  })
})

describe('indexSamples', () => {
  const index = indexSamples(['sfx/zombie-groan-2.ogg', 'sfx/zombie-groan-1.ogg', 'sfx/melee-hit.ogg', 'readme.md'])

  it('answers to the full name and, for -N files, the shared base name', () => {
    expect(index.byName.get('zombie-groan')).toEqual(['sfx/zombie-groan-1.ogg', 'sfx/zombie-groan-2.ogg'])
    expect(index.byName.get('zombie-groan-2')).toEqual(['sfx/zombie-groan-2.ogg'])
    expect(index.byName.get('melee-hit')).toEqual(['sfx/melee-hit.ogg'])
    expect(index.byName.has('readme')).toBe(false)
  })

  it('picks every variant across the random range, and nothing for an unknown name', () => {
    expect(pickSample(index, 'zombie-groan', 0)).toBe('sfx/zombie-groan-1.ogg')
    expect(pickSample(index, 'zombie-groan', 0.99)).toBe('sfx/zombie-groan-2.ogg')
    expect(pickSample(index, 'zombie-groan', 1)).toBe('sfx/zombie-groan-2.ogg')
    expect(pickSample(index, 'zombie-groan', Number.NaN)).toBe('sfx/zombie-groan-1.ogg')
    expect(pickSample(index, 'dig', 0.5)).toBeNull()
  })
})

describe('parseManifest', () => {
  it('keeps the strings of an array and treats anything else as no files', () => {
    expect(parseManifest(['sfx/a.ogg', 3, null])).toEqual(['sfx/a.ogg'])
    expect(parseManifest({ files: [] })).toEqual([])
    expect(parseManifest(null)).toEqual([])
  })
})
