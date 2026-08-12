import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { effectScope } from 'vue'
import { useTypingIndicator } from '@/composables/useTypingIndicator'

/** Runs the composable inside a scope so onScopeDispose can be exercised. */
function withScope<T>(fn: () => T): { result: T; dispose: () => void } {
  const scope = effectScope()
  const result = scope.run(fn)!

  return { result, dispose: () => scope.stop() }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useTypingIndicator', () => {
  describe('outbound throttling', () => {
    /**
     * The reason this composable exists. Naively wiring @input to a whisper
     * puts one socket frame per keypress on the wire.
     */
    it('sends one whisper for a burst of keystrokes', () => {
      const send = vi.fn()
      const { result: typing } = withScope(() => useTypingIndicator(send))

      for (let i = 0; i < 20; i++) typing.onLocalInput({ id: 1, name: 'A' })

      expect(send).toHaveBeenCalledTimes(1)
    })

    it('sends again once the throttle window has passed', () => {
      const send = vi.fn()
      const { result: typing } = withScope(() => useTypingIndicator(send))

      typing.onLocalInput({ id: 1, name: 'A' })
      vi.advanceTimersByTime(2100)
      typing.onLocalInput({ id: 1, name: 'A' })

      expect(send).toHaveBeenCalledTimes(2)
    })

    it('does not send again just before the window closes', () => {
      const send = vi.fn()
      const { result: typing } = withScope(() => useTypingIndicator(send))

      typing.onLocalInput({ id: 1, name: 'A' })
      vi.advanceTimersByTime(1900)
      typing.onLocalInput({ id: 1, name: 'A' })

      expect(send).toHaveBeenCalledTimes(1)
    })
  })

  describe('inbound state', () => {
    it('shows who is typing', () => {
      const { result: typing } = withScope(() => useTypingIndicator(vi.fn()))

      typing.onRemoteTyping({ id: 2, name: 'Zakariyo' })

      expect(typing.label.value).toBe('Zakariyo yozmoqda...')
    })

    it('collapses to a count when several people type', () => {
      const { result: typing } = withScope(() => useTypingIndicator(vi.fn()))

      typing.onRemoteTyping({ id: 2, name: 'A' })
      typing.onRemoteTyping({ id: 3, name: 'B' })

      expect(typing.label.value).toBe('2 kishi yozmoqda...')
    })

    /** "Typing" has no stop event — the other tab may simply vanish. */
    it('expires on its own when no further signal arrives', () => {
      const { result: typing } = withScope(() => useTypingIndicator(vi.fn()))

      typing.onRemoteTyping({ id: 2, name: 'A' })
      expect(typing.label.value).not.toBeNull()

      vi.advanceTimersByTime(4000)

      expect(typing.label.value).toBeNull()
    })

    it('keeps showing while signals keep arriving', () => {
      const { result: typing } = withScope(() => useTypingIndicator(vi.fn()))

      typing.onRemoteTyping({ id: 2, name: 'A' })
      vi.advanceTimersByTime(3000)
      typing.onRemoteTyping({ id: 2, name: 'A' })
      vi.advanceTimersByTime(3000)

      expect(typing.label.value).toBe('A yozmoqda...')
    })

    it('clears immediately when that person sends a message', () => {
      const { result: typing } = withScope(() => useTypingIndicator(vi.fn()))

      typing.onRemoteTyping({ id: 2, name: 'A' })
      typing.clear(2)

      expect(typing.label.value).toBeNull()
    })

    it('counts one person once however fast they type', () => {
      const { result: typing } = withScope(() => useTypingIndicator(vi.fn()))

      typing.onRemoteTyping({ id: 2, name: 'A' })
      typing.onRemoteTyping({ id: 2, name: 'A' })
      typing.onRemoteTyping({ id: 2, name: 'A' })

      expect(typing.names.value).toEqual(['A'])
    })
  })

  /** A pending expiry firing into a disposed component is a real leak. */
  it('cancels pending timers when the scope is disposed', () => {
    const { result: typing, dispose } = withScope(() => useTypingIndicator(vi.fn()))

    typing.onRemoteTyping({ id: 2, name: 'A' })
    dispose()

    expect(vi.getTimerCount()).toBe(0)
  })
})
