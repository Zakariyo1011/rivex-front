import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useFollowStore } from '@/stores/follows'
import type { FollowRelationship } from '@/types'

const follow = vi.fn()
const unfollow = vi.fn()

vi.mock('@/api/follows', () => ({
  followsApi: {
    follow: (id: number) => follow(id),
    unfollow: (id: number) => unfollow(id),
  },
}))

/**
 * One follow state for the whole app.
 *
 * The bug this store exists to end: follow state was owned by whichever screen
 * happened to be rendering it, so following somebody in search and then opening
 * their profile showed "Follow" again — the profile's copy had never heard
 * about the tap. Every test here is about the *shared* fact, not about one
 * screen's rendering of it.
 */
describe('follow store', () => {
  const base: FollowRelationship = {
    is_following: false,
    follow_status: null,
    is_followed_by: false,
    can_follow: true,
    follow_needs_approval: false,
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    follow.mockReset()
    unfollow.mockReset()
  })

  it('returns null for somebody it has never been told about', () => {
    expect(useFollowStore().get(7)).toBeNull()
  })

  it('remembers what the server said', () => {
    const store = useFollowStore()
    store.seed(7, base)

    expect(store.get(7)?.can_follow).toBe(true)
  })

  it('seeds many at once, as a page of results does', () => {
    const store = useFollowStore()
    store.seedMany({ 7: base, 9: { ...base, is_following: true } })

    expect(store.get(7)?.is_following).toBe(false)
    expect(store.get(9)?.is_following).toBe(true)
  })

  /**
   * 🔴 The whole point.
   *
   * Two screens seeded the same person; a follow performed through the store is
   * a single fact that both of them now read.
   */
  it('gives every screen the same answer after a follow', async () => {
    follow.mockResolvedValue({
      data: { data: { ...base, is_following: true, follow_status: 'accepted', can_follow: false } },
    })

    const store = useFollowStore()

    // Search seeded it; the profile seeded it too, with the same server answer.
    store.seed(7, base)
    store.seed(7, base)

    await store.toggle(7)

    // There is only one entry, so there is nothing left to disagree.
    expect(store.get(7)?.is_following).toBe(true)
    expect(store.get(7)?.can_follow).toBe(false)
  })

  it('flips optimistically before the request resolves', async () => {
    let resolve: (value: unknown) => void = () => {}
    follow.mockImplementation(() => new Promise((r) => (resolve = r)))

    const store = useFollowStore()
    store.seed(7, base)

    const inFlight = store.toggle(7)

    expect(store.get(7)?.is_following).toBe(true)
    expect(store.isPending(7)).toBe(true)

    resolve({ data: { data: { ...base, is_following: true, follow_status: 'accepted' } } })
    await inFlight

    expect(store.isPending(7)).toBe(false)
  })

  it('rolls back to exactly the previous state when the write fails', async () => {
    unfollow.mockRejectedValue(new Error('network'))

    const store = useFollowStore()
    const before = { ...base, is_following: true, follow_status: 'accepted' as const, can_follow: false }
    store.seed(7, before)

    await expect(store.toggle(7)).rejects.toThrow()

    expect(store.get(7)).toEqual(before)
    expect(store.isPending(7)).toBe(false)
  })

  /**
   * The server decides whether a follow became a request. A private account
   * answers `pending`, and the optimistic guess is discarded rather than merged
   * — otherwise the app would claim a follow that does not exist.
   */
  it('takes the servers answer over its own guess', async () => {
    follow.mockResolvedValue({
      data: { data: { ...base, is_following: false, follow_status: 'pending', can_follow: false } },
    })

    const store = useFollowStore()
    store.seed(7, { ...base, follow_needs_approval: true })

    await store.toggle(7)

    expect(store.get(7)?.follow_status).toBe('pending')
    expect(store.get(7)?.is_following).toBe(false)
  })

  it('does not send a second write while one is in flight', async () => {
    follow.mockImplementation(() => new Promise(() => {}))

    const store = useFollowStore()
    store.seed(7, base)

    void store.toggle(7)
    await store.toggle(7)

    expect(follow).toHaveBeenCalledTimes(1)
  })

  /** Unfollowing is the same write in the other direction. */
  it('unfollows when already following', async () => {
    unfollow.mockResolvedValue({ data: { data: { ...base, can_follow: true } } })

    const store = useFollowStore()
    store.seed(7, { ...base, is_following: true, follow_status: 'accepted', can_follow: false })

    await store.toggle(7)

    expect(unfollow).toHaveBeenCalledWith(7)
    expect(store.get(7)?.is_following).toBe(false)
  })

  /** A pending request is withdrawn by the same tap, not confirmed by it. */
  it('withdraws a pending request rather than following again', async () => {
    unfollow.mockResolvedValue({ data: { data: base } })

    const store = useFollowStore()
    store.seed(7, { ...base, follow_status: 'pending', can_follow: false })

    await store.toggle(7)

    expect(unfollow).toHaveBeenCalledWith(7)
    expect(follow).not.toHaveBeenCalled()
  })

  /**
   * These answers are about one viewer. Serving the previous account's
   * relationships to the next one would be wrong and a small privacy leak.
   */
  it('forgets everything on reset', () => {
    const store = useFollowStore()
    store.seed(7, base)
    store.reset()

    expect(store.get(7)).toBeNull()
  })
})
