import { ref } from 'vue'

const STORAGE_KEY = 'rivex_recent_searches'
const MAX = 8

/**
 * Recent searches, kept on the device and nowhere else.
 *
 * Deliberately not sent to the server. A search history is a record of what
 * somebody was curious about — often about other people — and storing it would
 * create a new thing to protect, a new thing to leak and a new thing to have to
 * delete on request. localStorage keeps the convenience without the obligation.
 */
const entries = ref<string[]>(load())

function load(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string').slice(0, MAX) : []
  } catch {
    // Corrupt or unavailable storage is not worth an error — the feature is a
    // convenience, and an empty history works.
    return []
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.value))
  } catch {
    // Private browsing, quota, disabled storage. Nothing to do about it.
  }
}

export function useRecentSearches() {
  function remember(term: string) {
    const value = term.trim().toLowerCase()
    if (!value) return

    // Re-searching an old term moves it to the front rather than duplicating.
    entries.value = [value, ...entries.value.filter((e) => e !== value)].slice(0, MAX)
    persist()
  }

  function forget(term: string) {
    entries.value = entries.value.filter((e) => e !== term)
    persist()
  }

  function clear() {
    entries.value = []
    persist()
  }

  return { entries, remember, forget, clear }
}
