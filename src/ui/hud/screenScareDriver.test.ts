import { beforeEach, describe, expect, it } from 'vitest'
import { PLACEHOLDERS } from '../../data/placeholders'
import { SCARE_FACE_IDS, scareFaceUrl } from '../../data/assets'
import { placeholderFaceLabel } from '../../data/screenScares'
import { resetRun } from '../../game/state/resetRun'
import { triggerScreenScare } from '../../game/state/screenScareActions'
import { useScreenScareStore } from '../../game/state/screenScareStore'
import { simClock } from '../../game/state/simClock'
import { registerMissingArt, useWaitingList, waitingPaths } from '../../game/state/waitingList'
import { emptyWaiting } from '../../game/systems/waitingList'
import { driveScreenScare, type StyledElement } from './screenScareDriver'

// Spec 11 Req 1.20, 8.16, 8.22: a face that is missing or fails to decode is drawn as a labelled
// rectangle, and the scare keeps its timing and its sting. The driver is the one frame loop for
// both, so it is run here against an image stand-in and a placeholder stand-in.

const el = (): StyledElement => ({ style: { transform: '', opacity: '', filter: '' } })

interface Run {
  frames: number
  stingGains: number[]
  stops: number
  releases: number
  ended: boolean
  styles: string[]
}

/** Runs one real scare to its end at 60 steps a second, with the face swapped at `swapAt` if given. */
function run(swapAt: number | null): Run {
  resetRun()
  simClock.now = 100
  // The hold length is rolled from Math.random; fix it so both runs get the same timeline.
  const random = Math.random
  Math.random = () => 0.5
  const outcome = triggerScreenScare('crawler')
  Math.random = random
  expect(outcome).toBe('started')
  const scare = useScreenScareStore.getState().scare.active!
  const image = el()
  const placeholder = el()
  let face = image
  const queue: Array<() => void> = []
  let perf = 0
  const out: Run = { frames: 0, stingGains: [], stops: 0, releases: 0, ended: false, styles: [] }
  const stop = driveScreenScare(scare, () => face, () => null, {
    startAudio: (g) => out.stingGains.push(g),
    stopAudio: () => out.stops++,
    releaseDuck: () => out.releases++,
    reducedMotion: () => false,
    raf: (cb) => queue.push(cb),
    cancelRaf: () => undefined,
    now: () => perf,
  })
  for (let i = 0; i < 600 && useScreenScareStore.getState().scare.active !== null; i++) {
    if (swapAt === i) face = placeholder
    simClock.now += 1 / 60
    perf += 1000 / 60
    const cbs = queue.splice(0)
    cbs.forEach((cb) => cb())
    out.frames++
    out.styles.push(`${face.style.transform}|${face.style.opacity}`)
  }
  out.ended = useScreenScareStore.getState().scare.active === null
  stop()
  return out
}

describe('screen scare with a face that fails to load', () => {
  beforeEach(() => {
    useWaitingList.setState({ waiting: emptyWaiting() })
  })

  it('keeps the same timing and the same sting when the image is swapped for the placeholder', () => {
    const withImage = run(null)
    const swapped = run(2)
    expect(withImage.ended).toBe(true)
    expect(swapped.ended).toBe(true)
    expect(swapped.frames).toBe(withImage.frames)
    expect(swapped.stingGains).toEqual(withImage.stingGains)
    expect(swapped.stingGains).toEqual([1])
    expect(swapped.stops).toBe(0)
    expect(swapped.releases).toBe(withImage.releases)
    // The placeholder is driven by the same transform and opacity curve as the image.
    expect(swapped.styles.slice(3)).toEqual(withImage.styles.slice(3))
  })

  it('labels the rectangle with the face id and registers the missing file once', () => {
    for (const id of SCARE_FACE_IDS) expect(placeholderFaceLabel(id)).toBe(`PLACEHOLDER ${id}`)
    const url = scareFaceUrl('face-zombie-1')
    registerMissingArt(url)
    registerMissingArt(url)
    expect(waitingPaths()).toEqual([url])
  })

  it('has a placeholders.ts row for every face', () => {
    for (const id of SCARE_FACE_IDS) {
      expect(PLACEHOLDERS.some((r) => r.path === scareFaceUrl(id) && r.feature === 'H1')).toBe(true)
    }
  })
})
