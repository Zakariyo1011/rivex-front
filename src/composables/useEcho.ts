import Echo from 'laravel-echo'
import Pusher from 'pusher-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(window as any).Pusher = Pusher

let echo: Echo<'reverb'> | null = null

export function getEcho(): Echo<'reverb'> {
  if (echo) return echo

  const token = localStorage.getItem('rivex_token')
  const apiRoot = import.meta.env.VITE_API_URL.replace(/\/api\/v1\/?$/, '')

  echo = new Echo({
    broadcaster: 'reverb',
    key: import.meta.env.VITE_REVERB_APP_KEY,
    wsHost: import.meta.env.VITE_REVERB_HOST,
    wsPort: Number(import.meta.env.VITE_REVERB_PORT),
    wssPort: Number(import.meta.env.VITE_REVERB_PORT),
    forceTLS: import.meta.env.VITE_REVERB_SCHEME === 'https',
    enabledTransports: ['ws', 'wss'],
    authEndpoint: `${apiRoot}/broadcasting/auth`,
    auth: {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    },
  })

  return echo
}

export function disconnectEcho() {
  echo?.disconnect()
  echo = null
}
