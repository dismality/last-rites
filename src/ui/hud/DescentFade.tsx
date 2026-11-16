import { useDescentStore } from '../../game/state/descentStore'

/** Black screen over the game while the player goes down the chapel stair (spec 09 task 11n-f). */
export function DescentFade() {
  const opacity = useDescentStore((s) => s.opacity)
  if (opacity <= 0) return null
  return (
    <div
      aria-hidden="true"
      className="descent-fade"
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        opacity,
        pointerEvents: 'none',
        zIndex: 40,
      }}
    />
  )
}
