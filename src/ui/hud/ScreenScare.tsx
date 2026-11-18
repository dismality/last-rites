// Screen jumpscare overlay (spec 11 H1, design bible §14.1): a face 85 vh tall, anchored to the
// bottom edge (zombies) or the top edge (ghosts). 70 ms in with no easing, a hold with scale
// jitter and a chromatic split, 250 ms out with a slide and a fade, and one white frame at the
// start. Everything runs on sim time from the store, so pausing (Esc) stops it within a frame.
// The sting, the 30% world dim and the camera shake start and end from here too, each gated by
// the effects `resolveScareFx` allowed when the scare began (the frame loop is in screenScareDriver.ts). `pointer-events: none`, aria-hidden.
import { useEffect, useRef, useState, type Ref } from 'react'
import { scareFaceUrl, type ScareFaceId } from '../../data/assets'
import { SCARE_SETS, SCREEN_SCARE_HEIGHT_VH, placeholderFaceLabel } from '../../data/screenScares'
import { useScreenScareStore } from '../../game/state/screenScareStore'
import { registerMissingArt } from '../../game/state/waitingList'
import { type ActiveScare } from '../../game/systems/screenScares'
import { driveScreenScare } from './screenScareDriver'
import './ScreenScare.css'
/** The face: the image, or the labelled flat rectangle once the file is missing or fails to decode. */
function ScareFace({ id, edge, failed, onFailed, faceRef }: {
  id: ScareFaceId
  edge: 'top' | 'bottom'
  failed: boolean
  onFailed: () => void
  faceRef: Ref<HTMLElement>
}) {
  const className = `screen-scare__face screen-scare__face--${edge}`
  const style = { height: `${SCREEN_SCARE_HEIGHT_VH}vh`, opacity: 0 }
  if (failed) {
    // PLACEHOLDER: /assets/scares/face-zombie-1.webp (every face id has its own row in data/placeholders.ts)
    return (
      <div ref={faceRef as Ref<HTMLDivElement>} className={`${className} screen-scare__placeholder`} style={style} data-testid="screen-scare-placeholder">
        {placeholderFaceLabel(id)}
      </div>
    )
  }
  return (
    <img
      ref={faceRef as Ref<HTMLImageElement>}
      className={className}
      src={scareFaceUrl(id)}
      alt=""
      draggable={false}
      style={style}
      onError={onFailed}
    />
  )
}

function ActiveScareView({ scare }: { scare: ActiveScare }) {
  const faceRef = useRef<HTMLElement>(null)
  const flashRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const { fx } = scare
  const edge = SCARE_SETS[scare.set].edge

  // The driver reads the face element each frame, so swapping the image for the placeholder
  // never restarts it: the timing and the sting stay exactly as they were.
  useEffect(
    () => driveScreenScare(scare, () => faceRef.current, () => flashRef.current),
    [scare],
  )

  const onFailed = (): void => {
    setFailed(true)
    registerMissingArt(scareFaceUrl(scare.image))
  }
  return (
    <div className="screen-scare" aria-hidden="true" data-testid="screen-scare" data-set={scare.set} data-image={scare.image}>
      {fx.showImage && <ScareFace id={scare.image} edge={edge} failed={failed} onFailed={onFailed} faceRef={faceRef} />}
      {fx.flash && <div ref={flashRef} className="screen-scare__flash" style={{ opacity: 0 }} />}
    </div>
  )
}

export function ScreenScare() {
  const active = useScreenScareStore((s) => s.scare.active)
  if (active === null) return null
  return <ActiveScareView key={active.startSim} scare={active} />
}
