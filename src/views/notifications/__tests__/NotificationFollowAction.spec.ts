import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import NotificationsView from '@/views/notifications/NotificationsView.vue'
import { useNotificationsStore } from '@/stores/notifications'
import type { AppNotification } from '@/types'

/**
 * Following back from the notification row.
 *
 * The row is the one place where "A followed you" and "follow A" meet, and it
 * had no action at all — the only way to follow back was to navigate to the
 * profile. The button here is the **same** `FollowButton` the profile uses, so
 * there is one follow interaction in the product rather than a second one that
 * drifts out of step with it.
 */
const follow = vi.fn()
const unfollow = vi.fn()

vi.mock('@/api/follows', () => ({
  followsApi: {
    follow: (...args: unknown[]) => follow(...args),
    unfollow: (...args: unknown[]) => unfollow(...args),
  },
}))

vi.mock('@/api/notifications', () => ({
  notificationsApi: {
    list: vi.fn(),
    markRead: vi.fn().mockResolvedValue({ data: { unread_count: 0 } }),
    markAllRead: vi.fn(),
  },
}))

vi.mock('@/composables/useEchoChannel', () => ({ useEchoChannel: vi.fn() }))
vi.mock('@/composables/useEcho', () => ({ onEchoReconnect: vi.fn(() => () => {}) }))
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ info: vi.fn(), success: vi.fn(), error: vi.fn() }),
}))
vi.mock('vue-router', () => ({
  RouterLink: { props: ['to'], template: '<a><slot /></a>' },
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ name: 'notifications' }),
}))

const FontAwesomeIcon = { props: ['icon'], template: '<i />' }

function followNotification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 'n1',
    type: 'new_follower',
    title: 'Jasur sizni kuzata boshladi',
    body: '',
    data: { type: 'new_follower', user_id: 2, username: 'jasur' },
    read: false,
    created_at: new Date().toISOString(),
    actor: {
      id: 2,
      name: 'Jasur',
      display_name: 'Jasur',
      username: 'jasur',
      profile: { avatar_url: null, bio: null, age: null, location_name: null },
    },
    relationship: {
      is_following: false,
      follow_status: null,
      is_followed_by: true,
      can_follow: true,
      follow_needs_approval: false,
    },
    ...overrides,
  } as AppNotification
}

function mountView(notifications: AppNotification[]) {
  setActivePinia(createPinia())

  const store = useNotificationsStore()
  store.notifications = notifications
  store.loaded = true

  const wrapper = mount(NotificationsView, {
    global: {
      components: { FontAwesomeIcon },
      stubs: {
        AppLayout: { template: '<div><slot name="header" /><slot /></div>' },
        AppTabs: true,
        EmptyState: true,
        ErrorState: true,
        Skeleton: true,
        Avatar: { props: ['src', 'name', 'size'], template: '<span class="avatar" />' },
      },
    },
  })

  return { wrapper, store }
}

describe('follow action on a notification row', () => {
  beforeEach(() => {
    follow.mockReset()
    unfollow.mockReset()
  })

  it('offers Follow on a "followed you" row', () => {
    const { wrapper } = mountView([followNotification()])

    expect(wrapper.text()).toContain('Kuzatish')
  })

  it('shows the actor and their handle', () => {
    const { wrapper } = mountView([followNotification()])

    expect(wrapper.find('.avatar').exists()).toBe(true)
    expect(wrapper.text()).toContain('@jasur')
  })

  it('reads Following once the follow exists', () => {
    const { wrapper } = mountView([
      followNotification({
        relationship: {
          is_following: true,
          follow_status: 'accepted',
          is_followed_by: true,
          can_follow: false,
          follow_needs_approval: false,
        },
      }),
    ])

    expect(wrapper.text()).toContain('Kuzatilmoqda')
  })

  it('follows back and stores the state the server returns', async () => {
    follow.mockResolvedValue({
      data: {
        data: {
          is_following: true,
          follow_status: 'accepted',
          is_followed_by: true,
          can_follow: false,
          follow_needs_approval: false,
        },
      },
    })

    const { wrapper, store } = mountView([followNotification()])

    await wrapper.find('button[type="button"][aria-busy]').trigger('click')
    await new Promise((r) => setTimeout(r, 0))

    expect(follow).toHaveBeenCalledWith(2)
    expect(store.notifications[0]!.relationship!.is_following).toBe(true)
  })

  /** A failed follow must put the row back, not leave it claiming success. */
  it('rolls the row back when the follow fails', async () => {
    follow.mockRejectedValue(new Error('nope'))

    const { wrapper, store } = mountView([followNotification()])

    await wrapper.find('button[type="button"][aria-busy]').trigger('click')
    await new Promise((r) => setTimeout(r, 0))

    expect(store.notifications[0]!.relationship!.is_following).toBe(false)
    expect(store.notifications[0]!.relationship!.can_follow).toBe(true)
  })

  it('renders no follow action on a row with no actor', () => {
    const { wrapper } = mountView([
      followNotification({
        type: 'payment_refunded',
        title: "To'lov qaytarildi",
        actor: null,
        relationship: null,
      }),
    ])

    expect(wrapper.text()).not.toContain('Kuzatish')
    expect(wrapper.find('.avatar').exists()).toBe(false)
  })

  /** A blocked actor comes back with neither, so the row must stay inert. */
  it('renders no follow action when the server withheld the relationship', () => {
    const { wrapper } = mountView([followNotification({ relationship: null })])

    expect(wrapper.text()).not.toContain('Kuzatish')
  })
})
