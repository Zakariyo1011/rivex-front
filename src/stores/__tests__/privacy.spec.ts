import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePrivacyStore } from '@/stores/privacy'
import { privacyApi, type PrivacyResponse } from '@/api/privacy'

vi.mock('@/api/privacy', () => ({
  privacyApi: {
    show: vi.fn(),
    update: vi.fn(),
  },
}))

const OPTIONS: PrivacyResponse['options'] = {
  visibility: [
    { value: 'everyone', label: 'Hamma', description: '' },
    { value: 'followers', label: 'Kuzatuvchilar', description: '' },
    { value: 'only_me', label: 'Faqat men', description: '' },
  ],
  follow_policy: [
    { value: 'everyone', label: 'Hamma', description: '' },
    { value: 'verified_only', label: 'Tasdiqlangan', description: '' },
    { value: 'nobody', label: 'Hech kim', description: '' },
  ],
}

function response(overrides: Partial<PrivacyResponse['data']> = {}): { data: PrivacyResponse } {
  return {
    data: {
      data: {
        profile_visibility: 'everyone',
        who_can_follow: 'everyone',
        who_can_see_followers: 'everyone',
        discoverable_in_search: true,
        show_online_status: true,
        follow_needs_approval: false,
        ...overrides,
      },
      options: OPTIONS,
    },
  }
}

describe('privacy store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(privacyApi.show).mockReset()
    vi.mocked(privacyApi.update).mockReset()
  })

  it('loads settings and the option lists', async () => {
    vi.mocked(privacyApi.show).mockResolvedValue(response() as never)

    const store = usePrivacyStore()
    await store.fetch()

    expect(store.settings?.profile_visibility).toBe('everyone')
    expect(store.options?.visibility).toHaveLength(3)
    expect(store.error).toBe('')
  })

  it('surfaces a load failure instead of rendering an empty screen', async () => {
    vi.mocked(privacyApi.show).mockRejectedValue(new Error('network'))

    const store = usePrivacyStore()
    await store.fetch()

    expect(store.settings).toBeNull()
    expect(store.error).not.toBe('')
  })

  /**
   * The server owns fields the patch cannot know about — `follow_needs_approval`
   * follows from `profile_visibility` — so the response replaces the local
   * copy rather than being merged into it.
   */
  it('takes derived fields from the response, not from the patch', async () => {
    vi.mocked(privacyApi.show).mockResolvedValue(response() as never)
    vi.mocked(privacyApi.update).mockResolvedValue(
      response({ profile_visibility: 'followers', follow_needs_approval: true }) as never,
    )

    const store = usePrivacyStore()
    await store.fetch()
    await store.update({ profile_visibility: 'followers' })

    expect(store.settings?.profile_visibility).toBe('followers')
    expect(store.settings?.follow_needs_approval).toBe(true)
  })

  /**
   * A privacy toggle that stays switched after the server refused it is worse
   * than one that never moved: the user believes they are protected.
   */
  it('rolls the toggle back when the server refuses', async () => {
    vi.mocked(privacyApi.show).mockResolvedValue(response() as never)
    vi.mocked(privacyApi.update).mockRejectedValue(new Error('boom'))

    const store = usePrivacyStore()
    await store.fetch()
    await store.update({ discoverable_in_search: false })

    expect(store.settings?.discoverable_in_search).toBe(true)
    expect(store.error).not.toBe('')
  })

  it('sends only the changed field', async () => {
    vi.mocked(privacyApi.show).mockResolvedValue(response() as never)
    vi.mocked(privacyApi.update).mockResolvedValue(
      response({ show_online_status: false }) as never,
    )

    const store = usePrivacyStore()
    await store.fetch()
    await store.update({ show_online_status: false })

    expect(privacyApi.update).toHaveBeenCalledWith({ show_online_status: false })
  })

  it('does nothing before settings are loaded', async () => {
    const store = usePrivacyStore()
    await store.update({ discoverable_in_search: false })

    expect(privacyApi.update).not.toHaveBeenCalled()
  })
})
