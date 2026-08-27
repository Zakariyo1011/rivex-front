import { defineStore } from 'pinia'
import { ref } from 'vue'
import { followsApi } from '@/api/follows'
import type { FollowRelationship } from '@/types'

/**
 * The viewer's follow relationships, in one place.
 *
 * ## The problem this exists to solve
 *
 * Follow state was owned by whichever component happened to be rendering it.
 * `FollowButton` mutated through `update:relationship`, and each screen wrote
 * the answer back into its own copy — the search results array, the follower
 * list array, the notification row, the profile's own ref. Four copies of the
 * same fact, none of which could see the others.
 *
 * So following somebody from search and then opening their profile showed
 * "Follow" again, because the profile had fetched its own copy before the tap
 * and nothing told it. Same for a follow-back from a notification, and same in
 * reverse for an unfollow. Every screen was individually correct and the
 * product was not.
 *
 * ## What this is, and what it is not
 *
 * It is a **cache of server answers keyed by user id**, plus the one place that
 * performs the write. It is deliberately NOT a second follow system: it holds
 * no rules about who may follow whom, derives nothing, and invents nothing. The
 * server decides — including whether a follow came back `accepted` or `pending`
 * — and this only remembers what it said.
 *
 * Screens `seed()` the relationship the server sent with their own payload, and
 * read back through `get()`. A screen that has never seen a user gets `null`
 * and falls back to its own data, so nothing breaks while the cache is cold.
 */
export const useFollowStore = defineStore('follows', () => {
  /**
   * Keyed by user id, as strings, because that is what an object index is and
   * a Record<number, T> silently stringifies anyway.
   */
  const relationships = ref<Record<string, FollowRelationship>>({})

  /** In-flight user ids, so a double tap cannot send two writes. */
  const pending = ref<Record<string, boolean>>({})

  function get(userId: number): FollowRelationship | null {
    return relationships.value[String(userId)] ?? null
  }

  function isPending(userId: number): boolean {
    return pending.value[String(userId)] === true
  }

  /**
   * Record what the server said about a relationship.
   *
   * Called both by screens hydrating from their own payload and by this store
   * after a write. Replaced wholesale rather than merged: a partial merge would
   * let a stale `can_follow` from one endpoint survive a fresher answer from
   * another, which is the class of bug this store exists to end.
   */
  function seed(userId: number, relationship: FollowRelationship | null | undefined) {
    if (!relationship) return

    relationships.value = { ...relationships.value, [String(userId)]: { ...relationship } }
  }

  /** Seed many at once — a page of search results or a follower list. */
  function seedMany(entries: Record<string | number, FollowRelationship | null | undefined>) {
    const next = { ...relationships.value }

    for (const [id, relationship] of Object.entries(entries)) {
      if (relationship) next[String(id)] = { ...relationship }
    }

    relationships.value = next
  }

  /**
   * Follow or unfollow, whichever the current state calls for.
   *
   * ## Optimism with a real rollback
   *
   * The state flips before the request resolves, because a follow tap that sits
   * inert for 300ms reads as broken. That is only honest if the failure path
   * restores what was there — an optimistic update without a rollback is not
   * optimism, it is a lie that is usually true. So the previous relationship is
   * captured, restored on any error, and replaced by the server's own answer on
   * success.
   *
   * The server is authoritative in both directions: following a private account
   * comes back `pending`, not `accepted`, and the guess is discarded rather
   * than merged.
   *
   * Throws on failure so the caller can surface a message; the state is already
   * back to what it was by then.
   */
  async function toggle(userId: number): Promise<FollowRelationship> {
    const key = String(userId)
    const previous = relationships.value[key]

    if (!previous) throw new Error('No known relationship for user ' + userId)
    if (pending.value[key]) return previous

    const undoing = previous.is_following || previous.follow_status === 'pending'

    pending.value = { ...pending.value, [key]: true }

    // `can_follow: false` while following so a second tap cannot start a
    // duplicate request before the first resolves.
    seed(userId, {
      ...previous,
      is_following: undoing ? false : !previous.follow_needs_approval,
      follow_status: undoing ? null : previous.follow_needs_approval ? 'pending' : 'accepted',
      can_follow: undoing,
    })

    try {
      const { data } = undoing
        ? await followsApi.unfollow(userId)
        : await followsApi.follow(userId)

      seed(userId, data.data)

      return data.data
    } catch (e) {
      seed(userId, previous)
      throw e
    } finally {
      const next = { ...pending.value }
      delete next[key]
      pending.value = next
    }
  }

  /**
   * Forget everything.
   *
   * Called on sign-out: these answers are about one viewer, and serving the
   * previous account's relationships to the next one would be both wrong and a
   * small privacy leak.
   */
  function reset() {
    relationships.value = {}
    pending.value = {}
  }

  return { relationships, get, isPending, seed, seedMany, toggle, reset }
})
