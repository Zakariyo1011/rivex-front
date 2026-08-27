import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, ref, nextTick } from 'vue'
import FollowButton from '@/components/profile/FollowButton.vue'
import type { FollowRelationship } from '@/types'

const follow = vi.fn()
const unfollow = vi.fn()
const toastError = vi.fn()

vi.mock('@/api/follows', () => ({
  followsApi: {
    follow: (id: number) => follow(id),
    unfollow: (id: number) => unfollow(id),
  },
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ error: toastError, success: vi.fn() }),
}))

/**
 * The button flips before the server answers, which is only honest if the
 * failure path really does put it back. These tests exist because an optimistic
 * update without a working rollback passes every manual check — it is wrong
 * only when the network is, which is exactly when nobody is looking.
 */
describe('FollowButton', () => {
  beforeEach(() => {
    // A fresh Pinia per test. The button reads and writes follow state through
    // `useFollowStore` now (one source of truth across every screen), so it
    // needs one — and a store carried between tests would let one test's
    // optimistic update decide the next test's starting state.
    setActivePinia(createPinia())

    follow.mockReset()
    unfollow.mockReset()
    toastError.mockReset()
  })

  const base: FollowRelationship = {
    is_following: false,
    follow_status: null,
    is_followed_by: false,
    can_follow: true,
    follow_needs_approval: false,
  }

  /** Mounts the button inside a parent that owns the state, as the app does. */
  function mountButton(initial: Partial<FollowRelationship> = {}) {
    const relationship = ref<FollowRelationship>({ ...base, ...initial })

    const wrapper = mount(
      defineComponent({
        setup() {
          return () =>
            h(FollowButton, {
              userId: 7,
              relationship: relationship.value,
              'onUpdate:relationship': (value: FollowRelationship) => {
                relationship.value = value
              },
            })
        },
      }),
    )

    return { wrapper, relationship }
  }

  it('flips to following before the request resolves', async () => {
    let resolve: (value: unknown) => void = () => {}
    follow.mockImplementation(() => new Promise((r) => (resolve = r)))

    const { wrapper, relationship } = mountButton()

    wrapper.find('button').trigger('click')
    await nextTick()

    // Optimistic: the state has already moved while the call is in flight.
    expect(relationship.value.is_following).toBe(true)
    expect(wrapper.find('button').attributes('aria-busy')).toBe('true')

    resolve({ data: { data: { ...base, is_following: true, follow_status: 'accepted', can_follow: false } } })
    await nextTick()
  })

  it('restores the previous state when following fails', async () => {
    follow.mockRejectedValue(new Error('network'))

    const { wrapper, relationship } = mountButton()

    await wrapper.find('button').trigger('click')
    // `flushPromises`, not a fixed number of ticks: the write goes through the
    // follow store now, which is one more await than when this component owned
    // the request, and counting microtasks makes the test depend on the depth
    // of the call chain rather than on the behaviour.
    await flushPromises()

    // The whole point: back exactly where it started, and the user is told.
    expect(relationship.value).toEqual(base)
    expect(toastError).toHaveBeenCalled()
  })

  it('restores the previous state when unfollowing fails', async () => {
    unfollow.mockRejectedValue(new Error('network'))

    const before: FollowRelationship = {
      ...base,
      is_following: true,
      follow_status: 'accepted',
      can_follow: false,
    }
    const { wrapper, relationship } = mountButton(before)

    await wrapper.find('button').trigger('click')
    await flushPromises()

    expect(relationship.value).toEqual(before)
    expect(toastError).toHaveBeenCalled()
  })

  /**
   * The server decides whether a follow became a request. A private account
   * answers `pending`, and the optimistic guess must be discarded rather than
   * merged — otherwise the button would claim a follow that does not exist.
   */
  it('takes the servers answer over its own guess', async () => {
    follow.mockResolvedValue({
      data: { data: { ...base, is_following: false, follow_status: 'pending', can_follow: false } },
    })

    const { wrapper, relationship } = mountButton()

    await wrapper.find('button').trigger('click')
    await nextTick()
    await nextTick()

    expect(relationship.value.follow_status).toBe('pending')
    expect(relationship.value.is_following).toBe(false)
    expect(wrapper.text()).toContain("So'ralgan")
  })

  it('predicts a request rather than a follow for an approving account', async () => {
    let resolve: (value: unknown) => void = () => {}
    follow.mockImplementation(() => new Promise((r) => (resolve = r)))

    const { wrapper, relationship } = mountButton({ follow_needs_approval: true })

    wrapper.find('button').trigger('click')
    await nextTick()

    expect(relationship.value.follow_status).toBe('pending')
    expect(relationship.value.is_following).toBe(false)

    resolve({ data: { data: { ...base, follow_status: 'pending' } } })
    await nextTick()
  })

  it('does not fire a second request while one is in flight', async () => {
    follow.mockImplementation(() => new Promise(() => {}))

    const { wrapper } = mountButton()

    await wrapper.find('button').trigger('click')
    await nextTick()
    await wrapper.find('button').trigger('click')

    expect(follow).toHaveBeenCalledTimes(1)
  })

  it('is inert when the account does not accept follows', async () => {
    const { wrapper } = mountButton({ can_follow: false })

    await wrapper.find('button').trigger('click')

    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
    expect(follow).not.toHaveBeenCalled()
  })

  it('offers to follow back somebody who follows you', () => {
    const { wrapper } = mountButton({ is_followed_by: true })

    expect(wrapper.text()).toContain('Kuzatish')
  })
})
