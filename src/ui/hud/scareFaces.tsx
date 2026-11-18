// Drawn stand-ins for the screen jumpscare faces (spec 11 H1) until the painted images exist.
// Each is an SVG in the face's 3:4 frame: rotting zombies and a crawler rise from the bottom edge,
// the bride hangs from the top. Grain and warping come from SVG filters, so there are no files.
// PLACEHOLDER: /assets/scares/<face id>.webp (every face id has its own row in data/placeholders.ts)
import type { ScareFaceId } from '../../data/assets'

/** Shared defs: skin grain, a warp that makes edges ragged, and the dark vignette. */
function Defs({ id, skin, shade }: { id: string; skin: string; shade: string }) {
  return (
    <defs>
      <filter id={`${id}-grain`} x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="7" result="n" />
        <feColorMatrix in="n" type="saturate" values="0" result="g" />
        <feComposite in="g" in2="SourceGraphic" operator="in" result="gm" />
        <feBlend in="SourceGraphic" in2="gm" mode="multiply" />
      </filter>
      <filter id={`${id}-warp`}>
        <feTurbulence type="turbulence" baseFrequency="0.035" numOctaves="2" seed="3" result="t" />
        <feDisplacementMap in="SourceGraphic" in2="t" scale="14" />
      </filter>
      <radialGradient id={`${id}-skin`} cx="50%" cy="42%" r="62%">
        <stop offset="0%" stopColor={skin} />
        <stop offset="70%" stopColor={shade} />
        <stop offset="100%" stopColor="#050404" />
      </radialGradient>
      <radialGradient id={`${id}-socket`} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#000" />
        <stop offset="65%" stopColor="#0b0706" />
        <stop offset="100%" stopColor={shade} stopOpacity="0" />
      </radialGradient>
    </defs>
  )
}

/** A dead eye: a deep socket with a tiny pale pupil that catches the light. */
function Eye({ id, x, y, r, pupil = true }: { id: string; x: number; y: number; r: number; pupil?: boolean }) {
  return (
    <g>
      <ellipse cx={x} cy={y} rx={r * 1.25} ry={r} fill={`url(#${id}-socket)`} />
      {pupil && <circle cx={x + r * 0.1} cy={y + r * 0.05} r={r * 0.16} fill="#e9e4c8" />}
      {pupil && <circle cx={x + r * 0.1} cy={y + r * 0.05} r={r * 0.07} fill="#2b0d08" />}
    </g>
  )
}

/** A ragged open mouth with broken teeth. */
function Mouth({ cx, cy, w, h, teeth }: { cx: number; cy: number; w: number; h: number; teeth: number }) {
  const top = cy - h / 2
  const bottom = cy + h / 2
  const t = Array.from({ length: teeth }, (_, i) => {
    const x = cx - w / 2 + ((i + 0.5) / teeth) * w
    const long = (i * 37) % 3 === 0
    return (
      <g key={i}>
        <path d={`M${x - 6} ${top + 2} L${x + 6} ${top + 2} L${x + 2} ${top + (long ? 26 : 15)} Z`} fill="#c8bb92" />
        <path d={`M${x - 5} ${bottom - 2} L${x + 5} ${bottom - 2} L${x - 1} ${bottom - (long ? 12 : 20)} Z`} fill="#a89a72" />
      </g>
    )
  })
  return (
    <g>
      <path
        d={`M${cx - w / 2} ${cy} Q${cx - w / 3} ${top - 8} ${cx} ${top} Q${cx + w / 3} ${top - 6} ${cx + w / 2} ${cy} Q${cx + w / 3} ${bottom + 10} ${cx} ${bottom} Q${cx - w / 3} ${bottom + 12} ${cx - w / 2} ${cy} Z`}
        fill="#120605"
      />
      {t}
      <path d={`M${cx - w / 4} ${bottom} q4 30 -2 60 M${cx + w / 5} ${bottom} q-3 22 3 44`} stroke="#4a0d08" strokeWidth="5" fill="none" strokeLinecap="round" />
    </g>
  )
}

function Zombie({ id, variant }: { id: string; variant: 1 | 2 }) {
  const skin = variant === 1 ? '#8b9478' : '#9a8f78'
  const shade = variant === 1 ? '#3a4230' : '#40352a'
  return (
    <>
      <Defs id={id} skin={skin} shade={shade} />
      <g filter={`url(#${id}-warp)`} transform={variant === 2 ? 'rotate(-6 150 260)' : undefined}>
        {/* Head and neck rising from the bottom edge */}
        <path d="M70 400 L80 330 Q40 250 52 170 Q66 50 150 44 Q236 50 250 170 Q262 250 220 330 L230 400 Z" fill={`url(#${id}-skin)`} filter={`url(#${id}-grain)`} />
        {/* Torn patches and rot */}
        <path d="M190 90 q30 10 34 50 q-20 -8 -40 4 q6 -30 6 -54 Z" fill="#2b1a12" opacity="0.8" />
        <path d="M70 230 q14 -10 30 4 q-6 26 -26 30 Z" fill="#3b1410" opacity="0.7" />
        <path d="M110 70 l18 40 l-10 26 M200 200 l22 18 l-6 30" stroke="#1a0f0a" strokeWidth="3" fill="none" />
        {/* Brow ridge */}
        <path d="M76 150 Q150 120 226 150" stroke="#1d1a12" strokeWidth="10" fill="none" opacity="0.6" />
        <Eye id={id} x={110} y={172} r={26} pupil={variant === 1} />
        <Eye id={id} x={192} y={170} r={24} />
        {/* Nose cavity */}
        <path d="M150 196 l-14 36 q14 8 28 0 Z" fill="#0d0605" />
        <Mouth cx={150} cy={290} w={110} h={variant === 1 ? 70 : 90} teeth={variant === 1 ? 7 : 5} />
        {/* Blood from the eye */}
        <path d="M192 192 q-2 40 4 70 q4 14 -2 30" stroke="#5c0f0a" strokeWidth="5" fill="none" strokeLinecap="round" />
      </g>
    </>
  )
}

function Crawler({ id }: { id: string }) {
  return (
    <>
      <Defs id={id} skin="#a39a86" shade="#3d3528" />
      <g filter={`url(#${id}-warp)`}>
        {/* Clawed hands either side, gripping up over the edge */}
        {[-1, 1].map((s) => (
          <g key={s} transform={`translate(${150 + s * 112} 300) scale(${s} 1)`}>
            <path d="M-30 100 L-22 10 Q-10 -20 10 -16 L18 100 Z" fill="#6f6654" />
            {[0, 1, 2, 3].map((k) => (
              <path key={k} d={`M${-20 + k * 11} -6 q${-4 + k * 3} -60 ${8 + k * 2} -96`} stroke="#6f6654" strokeWidth="8" fill="none" strokeLinecap="round" />
            ))}
          </g>
        ))}
        {/* A gaunt, stretched head, low and wide, no eyes, all mouth */}
        <path d="M60 400 Q30 300 60 220 Q90 140 150 136 Q210 140 240 220 Q270 300 240 400 Z" fill={`url(#${id}-skin)`} filter={`url(#${id}-grain)`} />
        {/* Blind, sunken sockets and the skin stretched between them */}
        <Eye id={id} x={112} y={214} r={20} pupil={false} />
        <Eye id={id} x={188} y={214} r={20} pupil={false} />
        <path d="M100 236 q6 26 -4 44 M200 236 q-6 26 4 44 M150 190 l-6 40" stroke="#1a100b" strokeWidth="3" fill="none" />
        <Mouth cx={150} cy={315} w={140} h={120} teeth={9} />
      </g>
    </>
  )
}

function Bride({ id, variant }: { id: string; variant: 1 | 2 }) {
  return (
    <>
      <Defs id={id} skin="#e2ddd2" shade="#7c7a78" />
      <g filter={`url(#${id}-warp)`} transform={variant === 2 ? 'rotate(180 150 200) translate(0 -20)' : undefined}>
        {/* Long black hair hanging from the top edge */}
        <path d="M20 0 L280 0 L290 360 Q250 300 236 380 Q210 260 200 400 L100 400 Q90 260 64 380 Q50 300 10 360 Z" fill="#0a0808" />
        {/* The face, hung upside down-ish from the top */}
        <ellipse cx="150" cy="170" rx="78" ry="104" fill={`url(#${id}-skin)`} filter={`url(#${id}-grain)`} />
        {/* Torn veil */}
        <path d="M60 60 Q150 20 240 60 L230 120 Q150 90 70 120 Z" fill="#cfcac0" opacity="0.35" />
        {/* Hair strands across the face */}
        <path d="M100 70 q10 90 -8 210 M120 66 q4 60 -6 130 M206 70 q-6 80 10 200" stroke="#0a0808" strokeWidth="5" fill="none" />
        <Eye id={id} x={120} y={160} r={22} pupil={false} />
        <Eye id={id} x={182} y={160} r={22} pupil={false} />
        {/* Black tears */}
        <path d="M118 180 q-3 50 4 110 M184 180 q4 46 -2 96" stroke="#0a0606" strokeWidth="6" fill="none" strokeLinecap="round" />
        {/* A long, too-wide open mouth */}
        <ellipse cx="150" cy="240" rx="22" ry={variant === 1 ? 38 : 46} fill="#050303" />
      </g>
    </>
  )
}

/** The drawn face for an id. Fills its box at 3:4 like the painted image would. */
export function DrawnScareFace({ id }: { id: ScareFaceId }) {
  const key = `sf-${id}`
  return (
    <svg viewBox="0 0 300 400" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {id === 'face-zombie-1' && <Zombie id={key} variant={1} />}
      {id === 'face-zombie-2' && <Zombie id={key} variant={2} />}
      {id === 'face-crawler' && <Crawler id={key} />}
      {id === 'ghost-bride-1' && <Bride id={key} variant={1} />}
      {id === 'ghost-bride-2' && <Bride id={key} variant={2} />}
    </svg>
  )
}
