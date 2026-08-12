import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent, h, ref, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { makeFakeEcho, type FakeEcho } from './echoFake'

const state = { echo: null as FakeEcho | null, api: null as never }

vi.mock('@/composables/useEcho', () => ({
  getEcho: () => state.api,
  trackChannel: vi.fn(),
  untrackChannel: vi.fn(),
  onEchoReconnect: vi.fn(() => () => {}),
}))

type UseEchoChannel = typeof import('@/composables/useEchoChannel').useEchoChannel

/**
 * Re-imported per test.
 *
 * The composable keeps a module-level reference count so two components can
 * share a channel — correct in an app that boots once, but it would carry
 * counts from one test into the next and mask a missing `leave`.
 */
let useEchoChannel: UseEchoChannel

/** Mounts a component whose only job is to hold a subscription. */
function mountWithChannel(
  name: () => string | null,
  options: Parameters<UseEchoChannel>[1] = {},
) {
  let handle: ReturnType<UseEchoChannel> | null = null

  const wrapper = mount(
    defineComponent({
      setup() {
        handle = useEchoChannel(name, options)

        return () => h('div')
      },
    }),
  )

  return { wrapper, handle: handle! }
}

beforeEach(async () => {
  const fake = makeFakeEcho()
  state.echo = fake.echo
  state.api = fake.api as never

  vi.resetModules()
  useEchoChannel = (await import('@/composables/useEchoChannel')).useEchoChannel
})

describe('useEchoChannel', () => {
  it('subscribes to the channel and registers each listener once', () => {
    const onMessage = vi.fn()

    mountWithChannel(() => 'match.1', { listeners: { '.MessageSent': onMessage } })

    expect(state.echo!.joins).toEqual(['match.1'])
    expect(state.echo!.channels.get('match.1')!.handlerCount('.MessageSent')).toBe(1)
  })

  it('delivers events to the handler', () => {
    const onMessage = vi.fn()
    mountWithChannel(() => 'match.1', { listeners: { '.MessageSent': onMessage } })

    state.echo!.channels.get('match.1')!.emit('.MessageSent', { id: 7 })

    expect(onMessage).toHaveBeenCalledWith({ id: 7 })
  })

  it('leaves the channel when the component unmounts', () => {
    const { wrapper } = mountWithChannel(() => 'match.1', { listeners: { '.MessageSent': vi.fn() } })

    wrapper.unmount()

    expect(state.echo!.leaves).toEqual(['match.1'])
  })

  it('does not subscribe at all while the name is null', () => {
    mountWithChannel(() => null, { listeners: { '.MessageSent': vi.fn() } })

    expect(state.echo!.joins).toEqual([])
  })

  /**
   * The Phase 5 bug in one test. The old view subscribed in `load()` (mount
   * only) and left `match.{current}` on unmount, so navigating between chats
   * leaked the previous channel and left its handler attached.
   */
  it('moves to the new channel when the name changes, leaving the old one', async () => {
    const matchId = ref(1)
    mountWithChannel(() => `match.${matchId.value}`, { listeners: { '.MessageSent': vi.fn() } })

    matchId.value = 2
    await nextTick()

    expect(state.echo!.leaves).toEqual(['match.1'])
    expect(state.echo!.joins).toEqual(['match.1', 'match.2'])
  })

  it('survives A -> B -> A -> B navigation with exactly one live handler', async () => {
    const matchId = ref(1)
    const onMessage = vi.fn()

    mountWithChannel(() => `match.${matchId.value}`, { listeners: { '.MessageSent': onMessage } })

    for (const id of [2, 1, 2]) {
      matchId.value = id
      await nextTick()
    }

    // One delivery, not four: the earlier subscriptions were genuinely removed.
    state.echo!.channels.get('match.2')!.emit('.MessageSent', { id: 1 })

    expect(onMessage).toHaveBeenCalledTimes(1)
    expect(state.echo!.channels.get('match.2')!.handlerCount('.MessageSent')).toBe(1)
  })

  it('keeps the channel alive while another subscriber is still using it', () => {
    const first = mountWithChannel(() => 'match.1', { listeners: { '.MessageSent': vi.fn() } })
    const second = mountWithChannel(() => 'match.1', { listeners: { '.MessageRead': vi.fn() } })

    first.wrapper.unmount()

    // Reference counted: the first leaving must not cut off the second.
    expect(state.echo!.leaves).toEqual([])

    second.wrapper.unmount()

    expect(state.echo!.leaves).toEqual(['match.1'])
  })

  it('removes only its own handler when sharing a channel', () => {
    const mine = vi.fn()
    const theirs = vi.fn()

    const first = mountWithChannel(() => 'match.1', { listeners: { '.MessageSent': mine } })
    mountWithChannel(() => 'match.1', { listeners: { '.MessageSent': theirs } })

    first.wrapper.unmount()
    state.echo!.channels.get('match.1')!.emit('.MessageSent', {})

    expect(mine).not.toHaveBeenCalled()
    expect(theirs).toHaveBeenCalledTimes(1)
  })

  it('registers notification handlers and detaches them on unmount', () => {
    const onNotification = vi.fn()
    const { wrapper } = mountWithChannel(() => 'App.Models.User.1', { onNotification })

    const channel = state.echo!.channels.get('App.Models.User.1')!
    const event = '.Illuminate\\Notifications\\Events\\BroadcastNotificationCreated'

    channel.emit(event, { id: 'abc' })
    expect(onNotification).toHaveBeenCalledTimes(1)

    wrapper.unmount()
    expect(state.echo!.leaves).toEqual(['App.Models.User.1'])
  })

  describe('presence', () => {
    it('wires here / joining / leaving and whispers', () => {
      const onHere = vi.fn()
      const onJoining = vi.fn()
      const onLeaving = vi.fn()
      const onTyping = vi.fn()

      const { handle } = mountWithChannel(() => 'match.1', {
        type: 'presence',
        onHere,
        onJoining,
        onLeaving,
        whispers: { typing: onTyping },
      })

      const channel = state.echo!.channels.get('match.1')!

      channel.hereHandler!([{ id: 1, name: 'A' }])
      channel.joiningHandler!({ id: 2, name: 'B' })
      channel.leavingHandler!({ id: 2, name: 'B' })
      channel.emitWhisper('typing', { id: 2, name: 'B' })

      expect(onHere).toHaveBeenCalledWith([{ id: 1, name: 'A' }])
      expect(onJoining).toHaveBeenCalledWith({ id: 2, name: 'B' })
      expect(onLeaving).toHaveBeenCalledWith({ id: 2, name: 'B' })
      expect(onTyping).toHaveBeenCalledWith({ id: 2, name: 'B' })

      handle.whisper('typing', { id: 1 })
      expect(channel.whispersSent).toEqual([{ event: 'typing', payload: { id: 1 } }])
    })
  })
})
