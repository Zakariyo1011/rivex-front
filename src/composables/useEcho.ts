import Echo from 'laravel-echo'
import Pusher from 'pusher-js'
import { ref, readonly } from 'vue'
import client from '@/api/client'

/**
 * Pusher's authorizer contract. Declared locally rather than imported from a
 * deep `pusher-js/types/...` path, which is not part of its public surface.
 */
interface ChannelAuthorizationData {
  auth: string
  channel_data?: string
  shared_secret?: string
}

type ChannelAuthorizationCallback = (
  error: Error | null,
  data: ChannelAuthorizationData | null,
) => void

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(window as any).Pusher = Pusher

/**
 * `connected`    — live; events are arriving.
 * `reconnecting` — the socket dropped and Pusher is retrying on its own.
 * `offline`      — no socket, and none being attempted.
 *
 * The UI treats `reconnecting` as a soft state on purpose: a two-second blip
 * while someone walks past a lift should not paint an error over the screen.
 */
export type ConnectionState = 'connected' | 'reconnecting' | 'offline'

const connectionState = ref<ConnectionState>('offline')

/** Read-only outside this module — only the socket may change its own state. */
export const echoConnectionState = readonly(connectionState)

let echo: Echo<'reverb'> | null = null

/** Channels we have joined, so logout can leave every one of them. */
const joinedChannels = new Set<string>()

/**
 * Callbacks that want to re-sync after a dropped connection.
 *
 * While the socket was down, events were missed — there is no replay. Anything
 * showing live state has to re-fetch once, or it will keep displaying a
 * snapshot from before the gap and never correct itself.
 */
type ReconnectHandler = () => void
const reconnectHandlers = new Set<ReconnectHandler>()

export function onEchoReconnect(handler: ReconnectHandler): () => void {
  reconnectHandlers.add(handler)

  return () => reconnectHandlers.delete(handler)
}

function apiRoot(): string {
  return import.meta.env.VITE_API_URL.replace(/\/api\/v1\/?$/, '')
}

export function getEcho(): Echo<'reverb'> {
  if (echo) return echo

  echo = new Echo({
    broadcaster: 'reverb',
    key: import.meta.env.VITE_REVERB_APP_KEY,
    wsHost: import.meta.env.VITE_REVERB_HOST,
    wsPort: Number(import.meta.env.VITE_REVERB_PORT),
    wssPort: Number(import.meta.env.VITE_REVERB_PORT),
    forceTLS: import.meta.env.VITE_REVERB_SCHEME === 'https',
    enabledTransports: ['ws', 'wss'],

    /**
     * Authorise through the same axios client the REST API uses.
     *
     * The previous implementation baked `localStorage.getItem('rivex_token')`
     * into the Echo config at module-evaluation time. On a fresh login the
     * module had already been evaluated — with no token — so every private
     * channel authorised as a guest and got a 403, and realtime was dead until
     * a full page reload. Going through the client means the request
     * interceptor supplies whatever token is current at the moment of the call.
     */
    authorizer: (channel: { name: string }) => ({
      authorize: (socketId: string, callback: ChannelAuthorizationCallback) => {
        client
          .post<ChannelAuthorizationData>(`${apiRoot()}/broadcasting/auth`, {
            socket_id: socketId,
            channel_name: channel.name,
          })
          .then((response) => callback(null, response.data))
          .catch((error: Error) => callback(error, null))
      },
    }),
  })

  bindConnectionState(echo)

  return echo
}

function bindConnectionState(instance: Echo<'reverb'>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const connection = (instance.connector as any)?.pusher?.connection
  if (!connection) return

  connection.bind('state_change', ({ current }: { previous: string; current: string }) => {
    const wasDown = connectionState.value !== 'connected'

    if (current === 'connected') {
      connectionState.value = 'connected'

      // Only re-sync after an actual gap, never on the first connect — the
      // views have just loaded their data through the REST API.
      if (wasDown && hasConnectedBefore) {
        reconnectHandlers.forEach((handler) => handler())
      }

      hasConnectedBefore = true

      return
    }

    if (current === 'connecting' || current === 'unavailable') {
      connectionState.value = hasConnectedBefore ? 'reconnecting' : 'offline'

      return
    }

    connectionState.value = 'offline'
  })
}

let hasConnectedBefore = false

/** Records a join so {@see disconnectEcho} can unwind it. */
export function trackChannel(name: string) {
  joinedChannels.add(name)
}

export function untrackChannel(name: string) {
  joinedChannels.delete(name)
}

/**
 * Tear the socket down completely — used on logout and account deletion.
 *
 * Leaving each channel first matters: `disconnect()` alone drops the transport
 * but leaves Echo's internal channel registry populated, so the next user to
 * log in on the same tab would re-subscribe to the previous user's private
 * channels.
 */
export function disconnectEcho() {
  if (!echo) {
    joinedChannels.clear()

    return
  }

  joinedChannels.forEach((name) => {
    try {
      echo?.leave(name)
    } catch {
      // Already gone; nothing to unwind.
    }
  })

  joinedChannels.clear()
  reconnectHandlers.clear()
  echo.disconnect()
  echo = null
  hasConnectedBefore = false
  connectionState.value = 'offline'
}
