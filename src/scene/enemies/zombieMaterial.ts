// Pure colour maths for zombie skins (no three.js, so it runs in Node tests).
// Why: the warm lantern floods a zombie at 1-2 m and a saturated tint reads as an orange cartoon.
// Capping saturation and value keeps the corpse pale, while still bright enough to see in the dark.

export type Rgb = readonly [number, number, number]

/** Highest saturation and value (0-1, sRGB) a zombie skin may have. */
export const ZOMBIE_MAX_SATURATION = 0.28
export const ZOMBIE_MAX_VALUE = 0.62
/** Floor so a dark tint (lurker, Crane) stays readable against black fog. */
export const ZOMBIE_MIN_VALUE = 0.1

/** Non-colour material settings that stop the lantern's specular and env light blowing the skin out. */
export const ZOMBIE_MATERIAL_PARAMS = {
  roughness: 1,
  metalness: 0,
  envMapIntensity: 0.25,
} as const

function rgbToHsv([r, g, b]: Rgb): [number, number, number] {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d > 0) {
    if (max === r) h = ((g - b) / d + 6) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
  }
  return [h, max === 0 ? 0 : d / max, max]
}

function hsvToRgb(h: number, s: number, v: number): Rgb {
  const f = (n: number) => {
    const k = (n + h) % 6
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1))
  }
  return [f(5), f(3), f(1)]
}

/**
 * Faint cold self-fill (sRGB) for a skin. Why: the lantern's ember light alone paints any grey
 * skin about 80% saturated, so even a pale corpse read as an orange cartoon at 1-2 m (measured in
 * Chrome, playtest item 7). A little moon-blue fill keeps the warm-versus-cold look and lets the
 * skin read grey. It scales with the skin so dark tints (lurker, Crane) stay dark.
 */
export function zombieColdFill(skin: Rgb): Rgb {
  const v = Math.max(skin[0], skin[1], skin[2])
  return [v * COLD_FILL[0], v * COLD_FILL[1], v * COLD_FILL[2]]
}
const COLD_FILL: Rgb = [0.2, 0.26, 0.34]

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

/** Multiplies base by tint, then caps saturation and value. Hue is kept so tints stay distinct. */
export function adjustZombieColor(base: Rgb, tint: Rgb): Rgb {
  const mixed: Rgb = [
    clamp01(base[0] * tint[0]),
    clamp01(base[1] * tint[1]),
    clamp01(base[2] * tint[2]),
  ]
  const [h, s, v] = rgbToHsv(mixed)
  return hsvToRgb(
    h,
    Math.min(s, ZOMBIE_MAX_SATURATION),
    Math.min(Math.max(v, ZOMBIE_MIN_VALUE), ZOMBIE_MAX_VALUE),
  )
}
