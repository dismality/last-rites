// Input: KeyboardEvent.code / mouse button -> action via settings.bindings.
// The factory takes plain events so it is testable without a DOM.

import { useSettingsStore } from '../../game/state'
import { isMenuOpen } from '../../game/state/menuState'

export interface InputSnapshot {
  /** -1 (back) .. 1 (forward) */
  forward: number
  /** -1 (left) .. 1 (right) */
  strafe: number
  sprint: boolean
  interact: boolean
  attack: boolean
  /** Block / aim-throw button (right mouse by default). */
  aim: boolean
  /** Mouse travel accumulated since the last consuming sample (pixels). */
  lookDX: number
  lookDY: number
}

const MOUSE_CODES = ['MouseLeft', 'MouseMiddle', 'MouseRight']

export function createInput(getBindings: () => Record<string, string>) {
  const held = new Set<string>()
  let lookDX = 0
  let lookDY = 0

  // Resolved at sample time so rebinding takes effect immediately.
  const isDown = (action: string): boolean => {
    const code = getBindings()[action]
    return code !== undefined && held.has(code)
  }

  const snapshot = (): InputSnapshot => ({
    forward: (isDown('MoveForward') ? 1 : 0) - (isDown('MoveBackward') ? 1 : 0),
    strafe: (isDown('MoveRight') ? 1 : 0) - (isDown('MoveLeft') ? 1 : 0),
    sprint: isDown('Sprint'),
    interact: isDown('Interact'),
    attack: isDown('Attack'),
    aim: isDown('Block'),
    lookDX,
    lookDY,
  })

  return {
    keyDown: (code: string) => void held.add(code),
    keyUp: (code: string) => void held.delete(code),
    mouseDown: (button: number) => {
      const c = MOUSE_CODES[button]
      if (c) held.add(c)
    },
    mouseUp: (button: number) => {
      const c = MOUSE_CODES[button]
      if (c) held.delete(c)
    },
    mouseMove: (dx: number, dy: number) => {
      lookDX += dx
      lookDY += dy
    },
    /** Drop held keys, e.g. on blur/pause, so nothing sticks. */
    releaseAll: () => {
      held.clear()
    },
    /** Read without consuming look deltas. */
    peek: snapshot,
    /** Read and reset look deltas. */
    sample: (): InputSnapshot => {
      const s = snapshot()
      lookDX = 0
      lookDY = 0
      return s
    },
  }
}

export const input = createInput(() => useSettingsStore.getState().bindings)

/**
 * Asks for pointer lock without ever throwing. The browser rejects the request (a promise in
 * current Chrome, a throw in older ones) when it isn't allowed, e.g. right after Esc.
 * Never grabs the cursor while a menu is open, because that would hide it.
 */
export function requestLock(el: HTMLElement | null | undefined): void {
  if (!el || isMenuOpen()) return
  try {
    const result = el.requestPointerLock() as Promise<void> | undefined
    result?.catch?.(() => {})
  } catch {
    /* not allowed right now; the next click tries again */
  }
}

/** Attach DOM listeners; mouse look only counts while the pointer is locked. */
export function installInput(canvas: HTMLElement): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    // Block Tab's focus change and similar while playing.
    if (document.pointerLockElement === canvas && e.code === 'Tab') e.preventDefault()
    input.keyDown(e.code)
  }
  const onKeyUp = (e: KeyboardEvent) => input.keyUp(e.code)
  const onMouseDown = (e: MouseEvent) => {
    if (document.pointerLockElement === canvas) input.mouseDown(e.button)
  }
  const onMouseUp = (e: MouseEvent) => input.mouseUp(e.button)
  const onMouseMove = (e: MouseEvent) => {
    if (document.pointerLockElement === canvas) input.mouseMove(e.movementX, e.movementY)
  }
  const onClick = () => {
    if (document.pointerLockElement !== canvas) requestLock(canvas)
  }
  const onLockChange = () => {
    if (document.pointerLockElement !== canvas) input.releaseAll()
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('mousedown', onMouseDown)
  window.addEventListener('mouseup', onMouseUp)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('blur', input.releaseAll)
  document.addEventListener('pointerlockchange', onLockChange)
  canvas.addEventListener('click', onClick)
  return () => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    window.removeEventListener('mousedown', onMouseDown)
    window.removeEventListener('mouseup', onMouseUp)
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('blur', input.releaseAll)
    document.removeEventListener('pointerlockchange', onLockChange)
    canvas.removeEventListener('click', onClick)
  }
}
