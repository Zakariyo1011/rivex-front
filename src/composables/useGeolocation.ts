import { computed, ref } from 'vue'

export type GeolocationState = 'idle' | 'prompting' | 'granted' | 'denied' | 'unavailable' | 'error'

export interface Coordinates {
  lat: number
  lng: number
}

/** Remembering the last fix avoids re-prompting on every Explore visit. */
const STORAGE_KEY = 'rivex_last_coords'
/** A stale fix is still better than none, but not forever. */
const MAX_AGE_MS = 30 * 60 * 1000

function readCached(): Coordinates | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { lat: number; lng: number; at: number }
    if (Date.now() - parsed.at > MAX_AGE_MS) return null
    return { lat: parsed.lat, lng: parsed.lng }
  } catch {
    return null
  }
}

const coords = ref<Coordinates | null>(readCached())
const state = ref<GeolocationState>(coords.value ? 'granted' : 'idle')

/**
 * Browser geolocation, treated as strictly optional.
 *
 * GPS is never required: every caller must keep working when the user says no,
 * when the device has no sensor, and when the request times out. Denial is a
 * normal outcome here, not an error path — Explore simply falls back to the
 * region/district the user picked during onboarding.
 *
 * Note this is the user's *current* position, used only to sort and filter what
 * they see. It is never sent to the profile or shown to anyone else; a home
 * address lives in user_locations and stays private.
 */
export function useGeolocation() {
  const isAvailable = typeof navigator !== 'undefined' && 'geolocation' in navigator

  const hasCoords = computed(() => coords.value !== null)
  const isDenied = computed(() => state.value === 'denied')

  async function request(options: { timeout?: number } = {}): Promise<Coordinates | null> {
    if (!isAvailable) {
      state.value = 'unavailable'
      return null
    }

    state.value = 'prompting'

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: options.timeout ?? 8000,
          maximumAge: MAX_AGE_MS,
          enableHighAccuracy: false,
        })
      })

      const next = { lat: position.coords.latitude, lng: position.coords.longitude }
      coords.value = next
      state.value = 'granted'

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...next, at: Date.now() }))
      } catch {
        // Private browsing / quota — the fix still works for this session.
      }

      return next
    } catch (error) {
      const code = (error as GeolocationPositionError | undefined)?.code
      state.value = code === 1 ? 'denied' : 'error'
      return null
    }
  }

  /** Drops the cached fix so Explore stops filtering by distance. */
  function clear() {
    coords.value = null
    state.value = 'idle'
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // nothing to do
    }
  }

  return { coords, state, hasCoords, isDenied, isAvailable, request, clear }
}
