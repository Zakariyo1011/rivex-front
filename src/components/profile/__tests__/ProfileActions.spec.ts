import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ProfileActions from '@/components/profile/ProfileActions.vue'
import type { FollowRelationship, MessagingState } from '@/types'

const openWith = vi.fn()
const push = vi.fn()
const toastError = vi.fn()

vi.mock('@/api/conversations', () => ({
  conversationsApi: { openWith: (id: number) => openWith(id) },
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ error: toastError, success: vi.fn() }),
}))

vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

vi.mock('@/api/follows', () => ({
  followsApi: { follow: vi.fn(), unfollow: vi.fn() },
}))

const FontAwesomeIcon = { props: ['icon'], template: '<i />' }

/**
 * "Xabar" opens a conversation; it never decides whether one exists.
 *
 * That distinction is the whole point of the endpoint being idempotent — the
 * uniqueness guarantee lives in a database index, and a client that checked
 * first would only be adding a window for two taps to disagree.
 */
describe('ProfileActions', () => {
  const relationship: FollowRelationship = {
    is_following: false,
    follow_status: null,
    is_followed_by: false,
    can_follow: true,
    follow_needs_approval: false,
  }

  const allowed: MessagingState = { can_message: true, reason: null }

  beforeEach(() => {
    openWith.mockReset()
    push.mockReset()
    toastError.mockReset()
  })

  function mountActions(messaging: MessagingState | null = allowed) {
    return mount(ProfileActions, {
      props: { userId: 7, relationship, messaging },
      global: { components: { FontAwesomeIcon }, stubs: { FollowButton: true } },
    })
  }

  function messageButton(wrapper: ReturnType<typeof mountActions>) {
    return wrapper.findAll('button').find((b) => b.text().includes('Xabar'))!
  }

  it('offers both actions beside each other', () => {
    const wrapper = mountActions()

    expect(wrapper.findComponent({ name: 'FollowButton' }).exists()).toBe(true)
    expect(messageButton(wrapper)).toBeTruthy()
  })

  it('opens the conversation and navigates to it', async () => {
    openWith.mockResolvedValue({ data: { data: { id: 12 }, created: true } })

    const wrapper = mountActions()
    await messageButton(wrapper).trigger('click')
    await new Promise((r) => setTimeout(r))

    expect(openWith).toHaveBeenCalledWith(7)
    expect(push).toHaveBeenCalledWith({ name: 'chat-detail', params: { conversationId: 12 } })
  })

  it('navigates to the same conversation when one already existed', async () => {
    openWith.mockResolvedValue({ data: { data: { id: 12 }, created: false } })

    const wrapper = mountActions()
    await messageButton(wrapper).trigger('click')
    await new Promise((r) => setTimeout(r))

    // `created` is deliberately not branched on — an existing thread and a new
    // one are the same outcome to the person pressing the button.
    expect(push).toHaveBeenCalledWith({ name: 'chat-detail', params: { conversationId: 12 } })
  })

  it('never checks whether a conversation exists before opening one', async () => {
    openWith.mockResolvedValue({ data: { data: { id: 12 }, created: true } })

    const wrapper = mountActions()
    await messageButton(wrapper).trigger('click')
    await new Promise((r) => setTimeout(r))

    expect(openWith).toHaveBeenCalledTimes(1)
  })

  it('does not fire twice while the first request is in flight', async () => {
    let resolve!: (value: unknown) => void
    openWith.mockReturnValue(new Promise((r) => (resolve = r)))

    const wrapper = mountActions()
    const button = messageButton(wrapper)

    await button.trigger('click')
    await button.trigger('click')

    expect(openWith).toHaveBeenCalledTimes(1)

    resolve({ data: { data: { id: 3 }, created: true } })
  })

  it('disables the button when messaging is refused, and says why on hover', () => {
    const wrapper = mountActions({
      can_message: false,
      reason: 'Bu foydalanuvchi yangi xabarlarni qabul qilmayapti.',
    })

    const button = messageButton(wrapper)

    expect(button.attributes('disabled')).toBeDefined()
    expect(button.attributes('title')).toContain('qabul qilmayapti')
  })

  it('does not call the endpoint when messaging is refused', async () => {
    const wrapper = mountActions({ can_message: false, reason: 'Bu foydalanuvchi topilmadi.' })

    await messageButton(wrapper).trigger('click')

    expect(openWith).not.toHaveBeenCalled()
  })

  it('hides the button entirely for an anonymous viewer', () => {
    const wrapper = mountActions(null)

    expect(wrapper.findAll('button').some((b) => b.text().includes('Xabar'))).toBe(false)
  })

  it('surfaces a server refusal instead of navigating', async () => {
    openWith.mockRejectedValue(new Error('nope'))

    const wrapper = mountActions()
    await messageButton(wrapper).trigger('click')
    await new Promise((r) => setTimeout(r))

    expect(push).not.toHaveBeenCalled()
    expect(toastError).toHaveBeenCalled()
  })
})
