import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import SearchView from '@/views/search/SearchView.vue'
import { MIN_SEARCH_LENGTH } from '@/api/search'

const overview = vi.fn()
const users = vi.fn()
const activities = vi.fn()
const categories = vi.fn()
const suggest = vi.fn()

vi.mock('@/api/search', async () => {
  const actual = await vi.importActual<typeof import('@/api/search')>('@/api/search')

  return {
    ...actual,
    searchApi: {
      overview: (q: string) => overview(q),
      users: (q: string, page: number) => users(q, page),
      activities: (q: string, page: number) => activities(q, page),
      categories: (q: string, page: number) => categories(q, page),
      suggest: (q: string) => suggest(q),
    },
  }
})

// The layout pulls in the whole app shell (nav, echo, notifications). The
// screen under test does not need any of it.
vi.mock('@/layouts/AppLayout.vue', () => ({
  default: defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) }),
}))

vi.mock('@/components/profile/FollowButton.vue', () => ({
  default: defineComponent({ props: ['userId', 'relationship'], setup: () => () => h('button', 'follow') }),
}))

function makeUser(id: number, username: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    username,
    display_name: `User ${id}`,
    name: `User ${id}`,
    phone_verified: true,
    identity_verified: false,
    verification_status: 'unverified',
    status: 'active',
    profile: { avatar_url: null, bio: null, age: null, location_name: null },
    created_at: '2026-01-01T00:00:00Z',
    ...extra,
  }
}

function emptyOverview(query: string) {
  return {
    data: {
      query,
      type: 'all',
      results: {
        users: { data: [], total: 0 },
        activities: { data: [], total: 0 },
        categories: { data: [], total: 0 },
      },
      relationships: {},
      meta: { counts: { all: 0, users: 0, activities: 0, categories: 0 } },
    },
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/search', name: 'search', component: { template: '<div />' } },
    { path: '/explore', name: 'explore', component: { template: '<div />' } },
    { path: '/u/:username', name: 'user-profile-by-username', component: { template: '<div />' } },
    { path: '/users/:id', name: 'user-profile', component: { template: '<div />' } },
    { path: '/activities/:id', name: 'activity-detail', component: { template: '<div />' } },
  ],
})

async function mountSearch() {
  setActivePinia(createPinia())
  await router.push('/search')
  await router.isReady()

  const wrapper = mount(SearchView, { global: { plugins: [router] } })
  await flushPromises()

  return wrapper
}

/** Types into the box and lets the debounce elapse. */
async function type(wrapper: Awaited<ReturnType<typeof mountSearch>>, value: string) {
  await wrapper.find('input').setValue(value)
  await vi.advanceTimersByTimeAsync(400)
  await flushPromises()
}

describe('SearchView', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    overview.mockReset()
    users.mockReset()
    activities.mockReset()
    categories.mockReset()
    suggest.mockReset()

    overview.mockImplementation((q: string) => Promise.resolve(emptyOverview(q)))
    suggest.mockResolvedValue({ data: { query: '', suggestions: [] } })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('sends nothing until the term reaches the shared minimum length', async () => {
    const wrapper = await mountSearch()

    await type(wrapper, 'a')

    // The server would answer this with an empty result; not asking is better.
    expect(overview).not.toHaveBeenCalled()
    expect(suggest).not.toHaveBeenCalled()
    expect(MIN_SEARCH_LENGTH).toBe(2)

    await type(wrapper, 'ga')
    expect(overview).toHaveBeenCalledWith('ga')
  })

  it('debounces so that typing does not send a request per keystroke', async () => {
    const wrapper = await mountSearch()

    await wrapper.find('input').setValue('ga')
    await wrapper.find('input').setValue('gam')
    await wrapper.find('input').setValue('gami')
    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()

    expect(overview).toHaveBeenCalledTimes(1)
    expect(overview).toHaveBeenCalledWith('gami')
  })

  it('shows a loading state while a search is in flight', async () => {
    let resolve: (value: unknown) => void = () => {}
    overview.mockImplementation(() => new Promise((r) => (resolve = r)))

    const wrapper = await mountSearch()
    await wrapper.find('input').setValue('gaming')
    await vi.advanceTimersByTimeAsync(400)

    expect(wrapper.html()).toContain('skeleton-shimmer')

    resolve(emptyOverview('gaming'))
    await flushPromises()
  })

  it('renders results grouped by type for a combined search', async () => {
    overview.mockResolvedValue({
      data: {
        query: 'gaming',
        type: 'all',
        results: {
          users: { data: [makeUser(1, 'gamer')], total: 1 },
          activities: {
            data: [
              {
                id: 9,
                title: 'Gaming evening',
                description: null,
                image_url: null,
                category: { id: 1, name: 'Gaming', slug: 'gaming', icon: null },
                location_name: 'Tashkent',
                latitude: null,
                longitude: null,
                start_at: '2027-01-01T18:00:00Z',
                duration_minutes: null,
                people_needed: 2,
                payment_type: 'free',
                amount: 0,
                status: 'published',
                owner_confirmed_completed_at: null,
                cancellation_reason: null,
                cancellation_note: null,
                cancelled_at: null,
                cancelled_late: false,
                owner: makeUser(1, 'gamer'),
                created_at: '2026-01-01T00:00:00Z',
              },
            ],
            total: 1,
          },
          categories: {
            data: [{ id: 1, name: 'Gaming', slug: 'gaming', icon: null, parent_id: null, activities_count: 3 }],
            total: 1,
          },
        },
        relationships: {},
        meta: { counts: { all: 3, users: 1, activities: 1, categories: 1 } },
      },
    })

    const wrapper = await mountSearch()
    await type(wrapper, 'gaming')

    expect(wrapper.text()).toContain('@gamer')
    expect(wrapper.text()).toContain('Gaming evening')
    expect(wrapper.text()).toContain('Gaming')
  })

  it('shows a no-result state rather than an empty screen', async () => {
    const wrapper = await mountSearch()
    await type(wrapper, 'zzzznothing')

    expect(wrapper.text()).toContain('Hech narsa topilmadi')
  })

  it('shows an error state with a retry when the request fails', async () => {
    overview.mockRejectedValue(new Error('network'))

    const wrapper = await mountSearch()
    await type(wrapper, 'gaming')

    // ErrorState renders a retry affordance; the results area must not silently
    // look like "no matches".
    expect(wrapper.text()).not.toContain('Hech narsa topilmadi')
    expect(wrapper.findAll('button').length).toBeGreaterThan(0)
  })

  it('switching tab requests only that type', async () => {
    users.mockResolvedValue({
      data: {
        query: 'gaming',
        type: 'users',
        data: [makeUser(1, 'gamer')],
        relationships: {},
        meta: { current_page: 1, last_page: 1, per_page: 20, total: 1 },
      },
    })

    const wrapper = await mountSearch()
    await type(wrapper, 'gaming')

    const tabs = wrapper.findAll('button').filter((b) => b.text().startsWith('Odamlar'))
    await tabs[0].trigger('click')
    await flushPromises()

    expect(users).toHaveBeenCalledWith('gaming', 1)
    expect(activities).not.toHaveBeenCalled()
  })

  it('offers recent searches when the box is empty', async () => {
    const wrapper = await mountSearch()

    await type(wrapper, 'gaming')
    await wrapper.find('input').setValue('')
    await flushPromises()

    expect(wrapper.text()).toContain("So'nggi qidiruvlar")
    expect(wrapper.text()).toContain('gaming')
  })

  it('shows autocomplete suggestions while typing', async () => {
    suggest.mockResolvedValue({
      data: {
        query: 'gam',
        suggestions: [
          { type: 'users', id: 1, label: 'Gamer', sublabel: '@gamer', username: 'gamer' },
          { type: 'categories', id: 2, label: 'PlayStation', sublabel: 'Gaming', slug: 'playstation' },
        ],
      },
    })

    const wrapper = await mountSearch()
    await wrapper.find('input').setValue('gam')
    await vi.advanceTimersByTimeAsync(250)
    await flushPromises()

    expect(suggest).toHaveBeenCalledWith('gam')
    expect(wrapper.text()).toContain('PlayStation')
  })

  it('does not let a slow earlier response overwrite a newer one', async () => {
    let resolveFirst: (value: unknown) => void = () => {}

    overview
      .mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)))
      .mockImplementationOnce(() =>
        Promise.resolve({
          data: {
            query: 'second',
            type: 'all',
            results: {
              users: { data: [makeUser(2, 'second_user')], total: 1 },
              activities: { data: [], total: 0 },
              categories: { data: [], total: 0 },
            },
            relationships: {},
            meta: { counts: { all: 1, users: 1, activities: 0, categories: 0 } },
          },
        }),
      )

    const wrapper = await mountSearch()

    await type(wrapper, 'first')
    await type(wrapper, 'second')

    expect(wrapper.text()).toContain('@second_user')

    // The stale response lands now, for a query nobody is looking at.
    resolveFirst({
      data: {
        query: 'first',
        type: 'all',
        results: {
          users: { data: [makeUser(1, 'stale_user')], total: 1 },
          activities: { data: [], total: 0 },
          categories: { data: [], total: 0 },
        },
        relationships: {},
        meta: { counts: { all: 1, users: 1, activities: 0, categories: 0 } },
      },
    })
    await flushPromises()

    expect(wrapper.text()).not.toContain('@stale_user')
    expect(wrapper.text()).toContain('@second_user')
  })

  it('runs a search immediately when one arrives in the URL', async () => {
    setActivePinia(createPinia())
    await router.push('/search?q=deeplink&type=users')
    await router.isReady()

    users.mockResolvedValue({
      data: {
        query: 'deeplink',
        type: 'users',
        data: [makeUser(3, 'linked')],
        relationships: {},
        meta: { current_page: 1, last_page: 1, per_page: 20, total: 1 },
      },
    })

    const wrapper = mount(SearchView, { global: { plugins: [router] } })
    await flushPromises()

    expect(users).toHaveBeenCalledWith('deeplink', 1)
    expect(wrapper.text()).toContain('@linked')
  })
})
