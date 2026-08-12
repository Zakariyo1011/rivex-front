import { vi } from 'vitest'

/**
 * A stand-in for Laravel Echo that records what was subscribed, listened to and
 * left.
 *
 * The bugs this suite exists to catch — a channel that is never left, a handler
 * registered twice, a `leave` aimed at a channel that was never joined — are
 * all statements about these call sequences, so the fake records them rather
 * than trying to simulate a socket.
 */

type Handler = (payload: unknown) => void

export class FakeChannel {
  readonly listeners = new Map<string, Handler[]>()
  readonly whisperListeners = new Map<string, Handler[]>()
  readonly whispersSent: { event: string; payload: unknown }[] = []

  hereHandler: ((members: unknown[]) => void) | null = null
  joiningHandler: ((member: unknown) => void) | null = null
  leavingHandler: ((member: unknown) => void) | null = null

  listen(event: string, handler: Handler) {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), handler])

    return this
  }

  stopListening(event: string, handler?: Handler) {
    const current = this.listeners.get(event) ?? []
    this.listeners.set(
      event,
      handler ? current.filter((h) => h !== handler) : [],
    )

    return this
  }

  notification(handler: Handler) {
    return this.listen('.Illuminate\\Notifications\\Events\\BroadcastNotificationCreated', handler)
  }

  listenForWhisper(event: string, handler: Handler) {
    this.whisperListeners.set(event, [...(this.whisperListeners.get(event) ?? []), handler])

    return this
  }

  stopListeningForWhisper(event: string) {
    this.whisperListeners.set(event, [])

    return this
  }

  whisper(event: string, payload: unknown) {
    this.whispersSent.push({ event, payload })

    return this
  }

  here(handler: (members: unknown[]) => void) {
    this.hereHandler = handler

    return this
  }

  joining(handler: (member: unknown) => void) {
    this.joiningHandler = handler

    return this
  }

  leaving(handler: (member: unknown) => void) {
    this.leavingHandler = handler

    return this
  }

  /** Test helper: deliver a server event to every registered handler. */
  emit(event: string, payload: unknown) {
    ;(this.listeners.get(event) ?? []).forEach((handler) => handler(payload))
  }

  emitWhisper(event: string, payload: unknown) {
    ;(this.whisperListeners.get(event) ?? []).forEach((handler) => handler(payload))
  }

  /** How many live handlers exist for an event — 2 means a duplicate. */
  handlerCount(event: string): number {
    return (this.listeners.get(event) ?? []).length
  }
}

export class FakeEcho {
  readonly channels = new Map<string, FakeChannel>()
  readonly joins: string[] = []
  readonly leaves: string[] = []

  private channel(name: string): FakeChannel {
    // Echo returns the *same* object for a repeated subscription, which is
    // exactly why duplicate listeners are possible at all.
    if (!this.channels.has(name)) this.channels.set(name, new FakeChannel())
    this.joins.push(name)

    return this.channels.get(name)!
  }

  private_(name: string) {
    return this.channel(name)
  }

  join(name: string) {
    return this.channel(name)
  }

  leave(name: string) {
    this.leaves.push(name)
    this.channels.delete(name)
  }
}

// `private` is a reserved word, so the class declares `private_` and the shape
// handed to the composable maps it back.
export function makeFakeEcho() {
  const echo = new FakeEcho()

  return {
    echo,
    api: {
      private: (name: string) => echo.private_(name),
      join: (name: string) => echo.join(name),
      leave: (name: string) => echo.leave(name),
    },
  }
}

export const trackChannel = vi.fn()
export const untrackChannel = vi.fn()
