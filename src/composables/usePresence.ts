import { computed, ref } from 'vue'
import type { PresenceMember } from '@/composables/useEchoChannel'

/**
 * Who else is on this channel right now.
 *
 * Presence is derived entirely from the socket — join, leave and the initial
 * `here` roster — and never persisted. "Last seen" is deliberately not stored:
 * it is a surveillance surface Rivex does not need, and the honest answer for
 * someone who is not connected is simply "offline".
 *
 * The roster is keyed by id because a user with two tabs open produces two
 * joins and one leave; without de-duplication closing one tab would show them
 * as offline while they are still there.
 */
export function usePresence() {
  const members = ref<Map<number, PresenceMember>>(new Map())
  const connected = ref(false)

  const others = computed(() => [...members.value.values()])

  function isOnline(userId: number | undefined): boolean {
    return userId !== undefined && members.value.has(userId)
  }

  function here(initial: PresenceMember[]) {
    members.value = new Map(initial.map((member) => [member.id, member]))
    connected.value = true
  }

  function joining(member: PresenceMember) {
    members.value = new Map(members.value).set(member.id, member)
  }

  function leaving(member: PresenceMember) {
    const next = new Map(members.value)
    next.delete(member.id)
    members.value = next
  }

  /**
   * The socket went away. Everyone is unknown, not offline — but with no
   * connection we cannot claim anyone is online either, so the roster empties
   * and the UI falls back to showing nothing rather than something false.
   */
  function reset() {
    members.value = new Map()
    connected.value = false
  }

  return { members, others, connected, isOnline, here, joining, leaving, reset }
}
