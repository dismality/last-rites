// Imported first in main.tsx, so the typing guard's listener is on the window before any other.
import { installTypingGuard } from './typingGuard'

if (typeof window !== 'undefined') installTypingGuard(window)
