// The crash and no-WebGL card's words, and the WebGL check (CrashScreen.tsx).

export const CRASH_TITLE = 'Something in the dark tripped over the wires.'
export const CRASH_LINES = [
  'The game hit an error it could not walk off. Your last save is safe in this browser.',
  'Reload to pick up from it. If it keeps happening, the dead are being unusually persistent.',
] as const

export const NO_WEBGL_TITLE = 'This browser cannot see the graveyard.'
export const NO_WEBGL_LINES = [
  'Last Rites draws its world with WebGL, and it is switched off or missing here.',
  'Try a recent Chrome, Edge or Firefox on a desktop, with hardware acceleration turned on in its settings.',
] as const

/** True when the browser can make a WebGL context (the game needs one to draw anything). */
export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'))
  } catch {
    return false
  }
}
