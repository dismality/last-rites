/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CrashBoundary, CrashCard } from './CrashScreen'
import { CRASH_TITLE, NO_WEBGL_LINES, NO_WEBGL_TITLE } from './crashScreenText'

function Boom(): never {
  throw new Error('boom')
}

describe('CrashScreen', () => {
  afterEach(cleanup)

  it('a render crash shows the crash card with a reload button, not a blank page', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <CrashBoundary>
        <Boom />
      </CrashBoundary>,
    )
    expect(screen.getByRole('alertdialog', { name: CRASH_TITLE })).toBeTruthy()
    expect(screen.getByRole('button', { name: /reload/ })).toBeTruthy()
    quiet.mockRestore()
  })

  it('the no-WebGL card says what to try next', () => {
    render(<CrashCard title={NO_WEBGL_TITLE} lines={NO_WEBGL_LINES} />)
    expect(screen.getByText(/hardware acceleration/)).toBeTruthy()
  })
})
