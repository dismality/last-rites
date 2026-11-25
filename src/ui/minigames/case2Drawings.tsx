// Drawings for Case 2's screens: a boot sole or the print, and a family crest on a shield. Flat SVG
// with strong contrast, so every feature the player must compare reads at any graphics setting
// (playtest story pass). PLACEHOLDER: hand-drawn or generated art can replace these later.
import type { SoleDef, VaneCrestId } from '../../data/cases'

const INK = '#2a1d12'
const CLAY = '#d9b23a'

/** Hobnail positions round the edge of a sole (viewBox 0 0 100 220). */
const RING = [
  [50, 18], [66, 24], [76, 40], [80, 60], [78, 82], [72, 104], [66, 126], [64, 150], [66, 176], [62, 198],
  [50, 204], [38, 198], [34, 176], [36, 150], [34, 126], [28, 104], [22, 82], [20, 60], [24, 40], [34, 24],
] as const

/** A sole seen from below: outline, heel, hobnails, a crack and clay where the def says so. */
export function SoleDrawing({ sole, label }: { sole: SoleDef; label: string }) {
  const narrow = sole.heel.startsWith('narrow')
  const broad = sole.heel.startsWith('broad')
  const fullRing = sole.nails.startsWith('a full ring')
  const few = sole.nails.startsWith('a few')
  const nails = fullRing ? RING : few ? RING.filter((_, i) => i % 5 === 0) : []
  const cracked = sole.sole.startsWith('cracked')
  const w = narrow ? 30 : broad ? 42 : 38
  return (
    <figure className="sole" aria-label={label}>
      <svg viewBox="0 0 100 220" role="img" aria-hidden="true">
        {/* Fore part of the sole. */}
        <path
          d={`M50 6 C${50 + w} 10 ${50 + w + 4} 70 ${50 + w - 4} 120 L${50 + w - 8} 140 L${50 - w + 8} 140 L${50 - w + 4} 120 C${50 - w - 4} 70 ${50 - w} 10 50 6 Z`}
          fill="#e8dcc4"
          stroke={INK}
          strokeWidth="3"
        />
        {/* Heel. */}
        {narrow ? (
          <rect x="40" y="168" width="20" height="44" rx="8" fill="#e8dcc4" stroke={INK} strokeWidth="3" />
        ) : (
          <rect x={50 - w + 10} y="158" width={(w - 10) * 2} height="56" rx={broad ? 18 : 4} fill="#e8dcc4" stroke={INK} strokeWidth="3" />
        )}
        {sole.heel.includes('iron') && (
          <path d={`M${50 - w + 12} 210 L${50 + w - 12} 210`} stroke={INK} strokeWidth="6" strokeLinecap="round" />
        )}
        {sole.clay && (
          <g fill={CLAY} opacity="0.9">
            <ellipse cx="44" cy="62" rx="16" ry="10" />
            <ellipse cx="58" cy="96" rx="12" ry="8" />
            <ellipse cx="48" cy="186" rx="12" ry="9" />
          </g>
        )}
        {nails.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="3.6" fill={INK} />
        ))}
        {cracked && <path d="M14 92 L34 88 L44 96 L58 86 L72 94 L86 90" fill="none" stroke={INK} strokeWidth="4" />}
      </svg>
      <figcaption>{label}</figcaption>
    </figure>
  )
}

/** The object under each crest's beast, drawn simply (viewBox 0 0 100 120). */
function CrestObject({ crest }: { crest: VaneCrestId }) {
  switch (crest) {
    case 'raven-coffin':
      return <path d="M42 64 L58 64 L64 76 L58 104 L42 104 L36 76 Z" fill={INK} />
    case 'owl-book':
      return <path d="M30 80 L50 86 L70 80 L70 102 L50 108 L30 102 Z M50 86 L50 108" fill={INK} stroke="#e8dcc4" strokeWidth="2" />
    case 'stag-gate':
      return <path d="M32 106 L32 76 Q50 60 68 76 L68 106 M41 106 L41 74 M50 106 L50 70 M59 106 L59 74" fill="none" stroke={INK} strokeWidth="4" />
    case 'hound-lantern':
      return <path d="M44 70 L56 70 L60 78 L60 100 L40 100 L40 78 Z M46 64 L54 64 L54 70 L46 70 Z" fill={INK} />
    case 'lion-spade':
      return <path d="M48 62 L52 62 L52 84 L62 88 L58 106 L42 106 L38 88 L48 84 Z" fill={INK} />
    case 'dove-bell':
      return <path d="M50 64 Q64 66 64 92 L70 100 L30 100 L36 92 Q36 66 50 64 Z M46 100 Q50 108 54 100" fill={INK} />
  }
}

/** The beast standing on top, as a simple silhouette over the object. */
function CrestBeast({ crest }: { crest: VaneCrestId }) {
  switch (crest) {
    case 'raven-coffin':
      return <path d="M30 58 Q38 36 54 38 L62 30 L60 40 Q72 46 70 58 Z M44 58 L42 64 M54 58 L56 64" fill={INK} stroke={INK} strokeWidth="3" />
    case 'owl-book':
      return <path d="M36 76 Q34 50 50 46 Q66 50 64 76 Z M40 48 L36 38 L46 46 M60 48 L64 38 L54 46" fill={INK} />
    case 'stag-gate':
      return <path d="M40 66 Q42 50 54 50 L62 40 M54 50 L46 36 M54 50 L58 30 M40 66 L60 66" fill="none" stroke={INK} strokeWidth="4" />
    case 'hound-lantern':
      return <path d="M30 62 Q34 46 52 48 L62 40 L66 50 Q70 60 62 62 Z" fill={INK} />
    case 'lion-spade':
      return <path d="M34 58 Q30 38 50 36 Q70 38 66 58 Z M50 36 L50 28" fill={INK} stroke={INK} strokeWidth="3" />
    case 'dove-bell':
      return <path d="M30 56 Q44 44 58 50 L70 44 L64 54 Q58 62 40 60 Z" fill={INK} />
  }
}

/** A crest: shield outline, beast on its object, and its name engraved below. */
export function CrestBadge({ crest, name }: { crest: VaneCrestId; name: string }) {
  return (
    <svg viewBox="0 0 100 120" role="img" aria-label={name} className="crest-badge">
      <path d="M10 8 L90 8 L90 60 Q90 100 50 114 Q10 100 10 60 Z" fill="#c9a24a" stroke={INK} strokeWidth="4" />
      <CrestBeast crest={crest} />
      <CrestObject crest={crest} />
    </svg>
  )
}
