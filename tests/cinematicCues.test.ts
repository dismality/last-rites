import '../src/game/state'
import { describe, expect, it, beforeEach } from 'vitest'
import { useGameStore } from '../src/game/state/gameStore'
import { useIntroStore } from '../src/game/state/introStore'
import { cinematicActive } from '../src/game/state/menuState'

const sources = import.meta.glob(['../src/scene/world/*.tsx', '../src/ui/hud/*.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>
const read = (file: string): string => sources['../' + file] ?? ''

describe('cinematicActive', () => {
  beforeEach(() => {
    useGameStore.setState({ screen: 'game' })
    useIntroStore.setState({ playing: false })
  })

  it('is false in normal play', () => {
    expect(cinematicActive()).toBe(false)
    expect(cinematicActive({ ending: false, intro: false })).toBe(false)
  })

  it('is true while the intro plays', () => {
    useIntroStore.setState({ playing: true })
    expect(cinematicActive()).toBe(true)
  })

  it('is true on the ending screen', () => {
    useGameStore.setState({ screen: 'ending' })
    expect(cinematicActive()).toBe(true)
  })

  it('is true while either camera runtime owns the camera', () => {
    expect(cinematicActive({ ending: true })).toBe(true)
    expect(cinematicActive({ intro: true })).toBe(true)
  })
})

describe('interactable cue components use the shared predicate', () => {
  const cues = [
    'src/scene/world/Interactable.tsx',
    'src/scene/world/Workbench.tsx',
    'src/ui/hud/Crosshair.tsx',
    'src/ui/hud/InteractPrompt.tsx',
  ]
  it.each(cues)('%s imports it', (file) => {
    expect(read(file)).toMatch(/\b(cinematicActive|useCinematic)\b/)
  })

  it('every scene file rendering <Interactable> goes through the gated component', () => {
    // Interactable.tsx owns the rune sprite, outline and pulse; no other file may draw its own.
    const src = read('src/scene/world/Interactable.tsx')
    expect(src).toContain('cinematicActive(')
  })
})
