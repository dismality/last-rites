// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { BESTIARY } from '../../data/bestiary'
import { useCreatureStore } from '../../game/state/creatureStore'
import { useSettingsStore } from '../../game/state/settingsStore'
import { bestiarySketchUrl } from '../../data/assets'
import { waitingPaths } from '../../game/state/waitingList'
import { Bestiary } from './Bestiary'

beforeEach(() => {
  useSettingsStore.setState({ showInfoDots: true })
  useCreatureStore.setState({ seen: [] })
})
afterEach(cleanup)

describe('Bestiary', () => {
  it('lists nothing, and leaks no name, while no creature has been seen', () => {
    const { container } = render(<Bestiary />)
    for (const e of BESTIARY) expect(container.textContent).not.toContain(e.name)
    expect(screen.queryByText(/What works/)).toBeNull()
    expect(screen.queryAllByRole('img')).toEqual([])
  })

  it('shows the field note and "What works" for seen creatures only', () => {
    useCreatureStore.setState({ seen: ['bride'] })
    const { container } = render(<Bestiary />)
    const bride = BESTIARY.find((e) => e.id === 'bride')!
    expect(container.textContent).toContain(bride.name)
    expect(container.textContent).toContain(bride.fieldNote)
    expect(container.textContent).toContain(bride.whatWorks)
    expect(container.textContent).not.toContain('Pale Crawler')
    expect(container.textContent).not.toContain('Corpse Hound')
  })

  it('shows the text card "Sketch not drawn yet" when a sketch fails to load', () => {
    useCreatureStore.setState({ seen: ['crawler'] })
    render(<Bestiary />)
    fireEvent.error(screen.getByRole('img', { name: /Sketch of the Pale Crawler/ }))
    expect(screen.getByText('Sketch not drawn yet')).toBeTruthy()
  })

  it('registers a failed sketch in the Waiting_List', () => {
    useCreatureStore.setState({ seen: ['hound'] })
    render(<Bestiary />)
    fireEvent.error(screen.getByRole('img', { name: /Sketch of the Corpse Hound/ }))
    expect(waitingPaths()).toContain(bestiarySketchUrl('hound'))
  })

  it('has a keyboard-reachable info dot', () => {
    render(<Bestiary />)
    expect(screen.getByRole('button', { name: 'About the Bestiary' })).toBeTruthy()
  })
})
