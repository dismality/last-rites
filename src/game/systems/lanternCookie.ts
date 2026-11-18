// The stand-in lantern cookie (spec 11 H7, Req 7.10): a soft round falloff, used while
// textures/lantern-cookie.png is missing. Pure; the scene wraps the bytes in a DataTexture.

/** Side length in pixels; small, since the falloff is smooth. */
export const COOKIE_PLACEHOLDER_SIZE = 64

/** Brightness 0..1 at a normalised distance from the centre (1 = the edge): smoothstep falloff. */
export function cookieFalloff(r: number): number {
  const t = Math.min(1, Math.max(0, Number.isFinite(r) ? r : 1))
  const s = 1 - t
  return s * s * (3 - 2 * s)
}

/** RGBA bytes, size*size*4, white with the falloff in all channels so the cone stays warm-neutral. */
export function softRoundCookie(size: number = COOKIE_PLACEHOLDER_SIZE): Uint8Array {
  const data = new Uint8Array(size * size * 4)
  const c = (size - 1) / 2
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = Math.round(cookieFalloff(Math.hypot(x - c, y - c) / (size / 2)) * 255)
      const i = (y * size + x) * 4
      data[i] = data[i + 1] = data[i + 2] = v
      data[i + 3] = 255
    }
  }
  return data
}
