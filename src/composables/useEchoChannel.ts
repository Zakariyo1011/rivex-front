import { onScopeDispose, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { getEcho, trackChannel, untrackChannel } from '@/composables/useEcho'

/**
 * One place that owns Echo subscription lifecycle.
 *
 * Every view that did this by hand got some part of it wrong. ChatDetailView
 * subscribed inside `load()` (which only ran `onMounted`) and left the channel
 * in `onUnmounted` using the *current* route param — so navigating
 * /chats/1 → /chats/2 reused the component instance, never re-subscribed, and
 * leaked `match.1` forever while trying to leave a `match.2` it had never
 * joined. Four such navigations, four live listeners, one message rendered
 * four times.
 *
 * The rules this encodes:
 *   - the channel name may be reactive; changing it leaves the old channel
 *     before joining the new one;
 *   - leaving is guaranteed on scope disposal, even if the component never
 *     finished loading;
 *   - listeners are removed individually, and the channel itself is only left
 *     once the last subscriber releases it — two components may safely watch
 *     the same channel.
 */

export type EchoChannelType = 'private' | 'presence'

/** Laravel's notification broadcast event, needed to detach the handler again. */
const NOTIFICATION_EVENT = '.Illuminate\\Notifications\\Events\\BroadcastNotificationCreated'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyChannel = any

export interface PresenceMember {
  id: number
  name: string
}

export interface EchoChannelOptions {
  type?: EchoChannelType
  /** Event name → handler. Server events are prefixed with a dot (`.MessageSent`). */
  listeners?: Record<string, (payload: never) => void>
  /** Client-to-client events (`whisper`), which never reach the server or the DB. */
  whispers?: Record<string, (payload: never) => void>
  /** Laravel notifications broadcast on this channel. */
  onNotification?: (payload: never) => void
  onHere?: (members: PresenceMember[]) => void
  onJoining?: (member: PresenceMember) => void
  onLeaving?: (member: PresenceMember) => void
}

/**
 * How many composable instances currently want a given channel.
 *
 * Echo hands back the same channel object for a repeated `.private(name)`, so
 * whoever leaves first would otherwise cut off everyone else still listening.
 */
const subscribers = new Map<string, number>()

function retain(name: string) {
  subscribers.set(name, (subscribers.get(name) ?? 0) + 1)
  trackChannel(name)
}

/** @returns true when nobody is left and the channel should actually be left. */
function release(name: string): boolean {
  const next = (subscribers.get(name) ?? 1) - 1

  if (next > 0) {
    subscribers.set(name, next)

    return false
  }

  subscribers.delete(name)
  untrackChannel(name)

  return true
}

export function useEchoChannel(
  name: MaybeRefOrGetter<string | null | undefined>,
  options: EchoChannelOptions = {},
) {
  const { type = 'private', listeners = {}, whispers = {}, onNotification } = options

  let current: string | null = null
  let channel: AnyChannel = null

  function join(target: string) {
    const echo = getEcho()

    channel = type === 'presence' ? echo.join(target) : echo.private(target)
    current = target
    retain(target)

    Object.entries(listeners).forEach(([event, handler]) => {
      channel.listen(event, handler)
    })

    Object.entries(whispers).forEach(([event, handler]) => {
      channel.listenForWhisper(event, handler)
    })

    if (onNotification) {
      channel.notification(onNotification)
    }

    if (type === 'presence') {
      if (options.onHere) channel.here(options.onHere)
      if (options.onJoining) channel.joining(options.onJoining)
      if (options.onLeaving) channel.leaving(options.onLeaving)
    }
  }

  function leave() {
    if (!current || !channel) return

    // Detach this instance's handlers first. If another component is still on
    // the channel it keeps its own, and only its handlers survive.
    Object.entries(listeners).forEach(([event, handler]) => {
      channel.stopListening(event, handler)
    })

    Object.entries(whispers).forEach(([event]) => {
      channel.stopListeningForWhisper(event)
    })

    if (onNotification) {
      channel.stopListening(NOTIFICATION_EVENT, onNotification)
    }

    if (release(current)) {
      getEcho().leave(current)
    }

    current = null
    channel = null
  }

  /** Client-only event. Never touches the server, never persisted. */
  function whisper(event: string, payload: unknown) {
    channel?.whisper(event, payload)
  }

  watch(
    () => toValue(name),
    (target) => {
      if (target === current) return

      leave()

      if (target) join(target)
    },
    { immediate: true },
  )

  // Covers unmount and any other scope teardown — including a component that
  // was disposed before its data finished loading.
  onScopeDispose(leave)

  return { whisper, leave }
}
