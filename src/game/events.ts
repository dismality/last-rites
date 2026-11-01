// Typed singleton event bus.
// Systems emit events as plain value objects; the GameLoop publishes them
// after each fixed tick. No DOM events, no EventEmitter inheritance.

import type { GameEvent } from './types'

type Handler = (event: GameEvent) => void
type TypedHandler<T extends GameEvent['type']> = (
  event: Extract<GameEvent, { type: T }>
) => void

const handlers = new Set<Handler>()

/** Publish an event to all current subscribers. */
export function emit(event: GameEvent): void {
  handlers.forEach((h) => h(event))
}

/** Subscribe to all events. Returns an unsubscribe function. */
export function subscribe(handler: Handler): () => void {
  handlers.add(handler)
  return () => handlers.delete(handler)
}

/** Subscribe to a specific event type only. Returns an unsubscribe function. */
export function subscribeToType<T extends GameEvent['type']>(
  type: T,
  handler: TypedHandler<T>
): () => void {
  const wrapper: Handler = (event) => {
    if (event.type === type) handler(event as Extract<GameEvent, { type: T }>)
  }
  handlers.add(wrapper)
  return () => handlers.delete(wrapper)
}

/** Clear all subscribers (used in tests). */
export function clearSubscribers(): void {
  handlers.clear()
}
