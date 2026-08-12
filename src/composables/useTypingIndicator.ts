import { computed, onScopeDispose, ref } from 'vue'

/**
 * "X yozmoqda..." without touching the server.
 *
 * Two costs are being avoided here, and both are why this is a composable
 * rather than three lines in the chat view:
 *
 *   - Sending. A keystroke event per keypress would put ~5 messages a second
 *     on the socket per typing user. Instead a whisper goes out at most once
 *     every THROTTLE_MS while the user is actively typing.
 *   - Receiving. "Typing" has no natural end event — the other side may close
 *     the tab mid-word — so every received signal carries its own expiry and
 *     the indicator clears itself.
 *
 * Whispers are client-to-client: they never reach a controller and are never
 * written to the database. Typing state is not data, it is a hint that expires.
 */

/** At most one outbound whisper per this many ms while typing continues. */
const THROTTLE_MS = 2000

/** How long a received "typing" stays true without a refresh. */
const EXPIRY_MS = 3500

export interface TypingPerson {
  id: number
  name: string
}

export function useTypingIndicator(send: (payload: TypingPerson) => void) {
  const typists = ref<Map<number, { name: string; timer: ReturnType<typeof setTimeout> }>>(new Map())
  let lastSentAt = 0

  const names = computed(() => [...typists.value.values()].map((entry) => entry.name))

  const label = computed(() => {
    if (names.value.length === 0) return null
    if (names.value.length === 1) return `${names.value[0]} yozmoqda...`

    return `${names.value.length} kishi yozmoqda...`
  })

  /** Call on every keystroke; the throttle decides whether anything is sent. */
  function onLocalInput(me: TypingPerson) {
    const now = Date.now()
    if (now - lastSentAt < THROTTLE_MS) return

    lastSentAt = now
    send(me)
  }

  /** Someone else's whisper arrived. */
  function onRemoteTyping(person: TypingPerson) {
    const existing = typists.value.get(person.id)
    if (existing) clearTimeout(existing.timer)

    const timer = setTimeout(() => {
      typists.value.delete(person.id)
      typists.value = new Map(typists.value)
    }, EXPIRY_MS)

    typists.value.set(person.id, { name: person.name, timer })
    typists.value = new Map(typists.value)
  }

  /** They sent a message, so they have manifestly stopped typing. */
  function clear(userId: number) {
    const existing = typists.value.get(userId)
    if (!existing) return

    clearTimeout(existing.timer)
    typists.value.delete(userId)
    typists.value = new Map(typists.value)
  }

  function reset() {
    typists.value.forEach((entry) => clearTimeout(entry.timer))
    typists.value = new Map()
    lastSentAt = 0
  }

  // Pending timers would otherwise fire into a disposed component.
  onScopeDispose(reset)

  return { label, names, onLocalInput, onRemoteTyping, clear, reset }
}
