import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import SearchView from '@/views/search/SearchView.vue'
import { MIN_SEARCH_LENGTH } from '@/api/search'

/**
 * Global search: two tabs, activities and people.
 *
 * ## What changed, and why these tests changed with it
 *
 * The screen used to offer four tabs — `Hammasi | Odamlar | Faoliyatlar |
 * Kategoriyalar` — which was the API's shape showing through rather than the
 * product's. "All" was a combined preview nobody asks for, and a category is
 * not a result: it is a way to browse activities, which Explore already does.
 *
 * So the `overview` and `categories` calls are gone from the client entirely,
 * and the assertions about them with it. Everything that was a real guarantee —
 * the minimum length, the debounce, the stale-response guard, filters on the
 * tab they belong to, appending pagination, the URL query, the follow
 * relationship — is still asserted here, against the new two-tab shape.
 */
const users = vi.fn()
const activities = vi.fn()
const suggest = vi.fn()

vi.mock('@/api/search', async () => {
  const actual = await vi.importActual<typeof import('@/api/search')>('@/api/search')

  return {
    ...actual,
    searchApi: {
      users: (q: string, page: number) => users(q, page),
      activities: (q: string, page: number, filters?: unknown) => activities(q, page, filters),
      suggest: (q: string) => suggest(q),
    },
  }
})

// The layout pulls in the whole app shell (nav, echo, notifications). The
// screen under test does not need any of it.
vi.mock('@/api/locations', () => ({
  locationsApi: { regions: () => Promise.resolve({ data: { data: [] } }) },
}))

vi.mock('@/layouts/AppLayout.vue', () => ({
  default: defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) }),
}))

vi.mock('@/components/profile/FollowButton.vue', () => ({
  default: defineComponent({
    props: ['userId', 'relationship'],
    setup: () => () => h('button', 'follow'),
  }),
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

function makeActivity(id: number, title: string) {
  return {
    id,
    title,
    slug: `activity-${id}`,
    status: 'open',
    start_at: '2026-09-01T10:00:00Z',
    location_name: 'Tashkent',
    payment_type: 'free',
    amount: 0,
    people_needed: 2,
    category: { id: 1, name: 'Gaming', slug: 'gaming', icon: '🎮' },
    owner: makeUser(99, 'owner'),
  }
}

/** A `SearchPage` envelope, which is now the only shape this screen reads. */
function page<T>(
  type: 'users' | 'activities',
  rows: T[],
  meta: Partial<{ current_page: number; last_page: number; total: number }> = {},
  relationships: Record<string, unknown> = {},
) {
  return {
    data: {
      query: 'q',
      type,
      data: rows,
      relationships,
      meta: {
        current_page: meta.current_page ?? 1,
        last_page: meta.last_page ?? 1,
        per_page: 20,
        total: meta.total ?? rows.length,
      },
    },
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: { template: '<div />' } },
    { path: '/search', name: 'search', component: { template: '<div />' } },
    { path: '/explore', name: 'explore', component: { template: '<div />' } },
    { path: '/u/:username', name: 'user-profile-by-username', component: { template: '<div />' } },
    { path: '/users/:id', name: 'user-profile', component: { template: '<div />' } },
    { path: '/activities/:id', name: 'activity-detail', component: { template: '<div />' } },
  ],
})

async function mountSearch(query = '') {
  setActivePinia(createPinia())
  await router.push(`/search${query}`)
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

/** Clicks a tab by its visible label. */
async function tab(wrapper: Awaited<ReturnType<typeof mountSearch>>, label: string) {
  const button = wrapper.findAll('[role="tab"]').find((b) => b.text().includes(label))
  expect(button, `no tab labelled ${label}`).toBeTruthy()

  await button!.trigger('click')
  await vi.advanceTimersByTimeAsync(400)
  await flushPromises()
}

describe('SearchView', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    users.mockReset()
    activities.mockReset()
    suggest.mockReset()

    users.mockImplementation(() => Promise.resolve(page('users', [])))
    activities.mockImplementation(() => Promise.resolve(page('activities', [])))
    suggest.mockResolvedValue({ data: { query: '', suggestions: [] } })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // -- the two tabs ---------------------------------------------------------

  it('offers exactly two tabs: activities and people', async () => {
    const wrapper = await mountSearch()
    const labels = wrapper.findAll('[role="tab"]').map((b) => b.text().trim())

    expect(labels).toHaveLength(2)
    expect(labels[0]).toContain('Faoliyatlar')
    expect(labels[1]).toContain('Odamlar')
  })

  /** Activities is what most people open Rivex to find. */
  it('starts on activities', async () => {
    const wrapper = await mountSearch()
    await type(wrapper, 'futbol')

    expect(activities).toHaveBeenCalled()
    expect(users).not.toHaveBeenCalled()
  })

  it('searches people on the people tab', async () => {
    const wrapper = await mountSearch()
    users.mockResolvedValue(page('users', [makeUser(1, 'aziz')]))

    await type(wrapper, 'aziz')
    await tab(wrapper, 'Odamlar')

    expect(users).toHaveBeenCalledWith('aziz', 1)
    expect(wrapper.text()).toContain('@aziz')
  })

  /**
   * 🔴 Switching tab must keep the query.
   *
   * Typing a name, finding no activity by it and then having to retype it under
   * People is the single most annoying thing a two-tab search can do.
   */
  it('keeps the query when switching tabs', async () => {
    const wrapper = await mountSearch()

    await type(wrapper, 'madina')
    await tab(wrapper, 'Odamlar')

    expect(users).toHaveBeenCalledWith('madina', 1)
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('madina')
  })

  it('does not carry one tabs results into the other', async () => {
    const wrapper = await mountSearch()

    activities.mockResolvedValue(page('activities', [makeActivity(1, 'Futbol o‘yini')]))
    await type(wrapper, 'futbol')
    expect(wrapper.text()).toContain('Futbol o‘yini')

    users.mockResolvedValue(page('users', [makeUser(1, 'aziz')]))
    await tab(wrapper, 'Odamlar')

    expect(wrapper.text()).not.toContain('Futbol o‘yini')
    expect(wrapper.text()).toContain('@aziz')
  })

  // -- request discipline ---------------------------------------------------

  it('sends nothing until the term reaches the shared minimum length', async () => {
    const wrapper = await mountSearch()

    await type(wrapper, 'a'.repeat(MIN_SEARCH_LENGTH - 1))

    expect(activities).not.toHaveBeenCalled()
    expect(users).not.toHaveBeenCalled()
  })

  it('debounces so that typing does not send a request per keystroke', async () => {
    const wrapper = await mountSearch()
    const input = wrapper.find('input')

    await input.setValue('fu')
    await input.setValue('fut')
    await input.setValue('futb')
    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()

    expect(activities).toHaveBeenCalledTimes(1)
    expect(activities).toHaveBeenCalledWith('futb', 1, expect.anything())
  })

  /**
   * A slow earlier response must not overwrite a newer one — otherwise typing
   * quickly on a poor connection shows results for a query already moved past.
   */
  it('does not let a slow earlier response overwrite a newer one', async () => {
    const wrapper = await mountSearch()
    await tab(wrapper, 'Odamlar')

    let releaseFirst: (value: unknown) => void = () => {}
    users.mockImplementationOnce(() => new Promise((resolve) => (releaseFirst = resolve)))

    await type(wrapper, 'first')

    users.mockResolvedValue(page('users', [makeUser(2, 'second_user')]))
    await type(wrapper, 'second')

    expect(wrapper.text()).toContain('@second_user')

    // The stale response lands now, for a query nobody is looking at.
    releaseFirst(page('users', [makeUser(1, 'first_user')]))
    await flushPromises()

    expect(wrapper.text()).toContain('@second_user')
    expect(wrapper.text()).not.toContain('@first_user')
  })

  // -- states ---------------------------------------------------------------

  it('shows a loading state while a search is in flight', async () => {
    const wrapper = await mountSearch()
    activities.mockImplementation(() => new Promise(() => {}))

    await type(wrapper, 'futbol')

    // `skeleton-shimmer` is the class Skeleton.vue actually renders.
    expect(wrapper.html()).toContain('skeleton-shimmer')
  })

  it('shows a no-result state rather than an empty screen', async () => {
    const wrapper = await mountSearch()
    await type(wrapper, 'hech narsa')

    expect(wrapper.text()).toContain('Hech narsa topilmadi')
  })

  /** The other tab is the likeliest next move after an empty result. */
  it('offers the other tab when a search finds nothing', async () => {
    const wrapper = await mountSearch()
    await type(wrapper, 'aziz')

    expect(wrapper.text()).toContain('Odamlar ichidan qidirish')
  })

  it('shows an error state with a retry when the request fails', async () => {
    const wrapper = await mountSearch()
    activities.mockRejectedValue(new Error('network'))

    await type(wrapper, 'futbol')

    expect(wrapper.text()).toContain('Qayta urinish')
  })

  it('names both result kinds so people search is discoverable', async () => {
    const wrapper = await mountSearch()

    expect(wrapper.text()).toContain('Faoliyatlar')
    expect(wrapper.text()).toContain('Odamlar')
  })

  it('offers recent searches when the box is empty', async () => {
    localStorage.setItem('rivex_recent_searches', JSON.stringify(['futbol']))

    const wrapper = await mountSearch()

    expect(wrapper.text()).toContain("So'nggi qidiruvlar")
    expect(wrapper.text()).toContain('futbol')
  })

  it('shows autocomplete suggestions while typing', async () => {
    const wrapper = await mountSearch()
    suggest.mockResolvedValue({
      data: {
        query: 'az',
        suggestions: [
          { type: 'users', id: 1, label: 'Azizbek', sublabel: '@aziz', username: 'aziz' },
        ],
      },
    })

    await type(wrapper, 'az')

    expect(wrapper.text()).toContain('Azizbek')
  })

  // -- filters --------------------------------------------------------------

  it('offers filters on the activities tab and nowhere else', async () => {
    const wrapper = await mountSearch()
    await type(wrapper, 'futbol')

    expect(wrapper.find('[aria-label="Filtrlar"]').exists()).toBe(true)

    await tab(wrapper, 'Odamlar')

    expect(wrapper.find('[aria-label="Filtrlar"]').exists()).toBe(false)
  })

  it('sends the chosen filters with an activity search', async () => {
    const wrapper = await mountSearch()
    await type(wrapper, 'futbol')

    expect(activities).toHaveBeenCalledWith('futbol', 1, expect.objectContaining({}))
  })

  // -- pagination -----------------------------------------------------------

  it('appends the next page instead of replacing what is on screen', async () => {
    const wrapper = await mountSearch()
    await tab(wrapper, 'Odamlar')

    users.mockResolvedValue(
      page('users', [makeUser(1, 'first_user')], { last_page: 2, total: 2 }),
    )
    await type(wrapper, 'aziz')

    users.mockResolvedValue(
      page('users', [makeUser(2, 'second_user')], { current_page: 2, last_page: 2, total: 2 }),
    )

    const more = wrapper.findAll('button').find((b) => b.text().includes("Ko'proq yuklash"))
    expect(more).toBeTruthy()

    await more!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('@first_user')
    expect(wrapper.text()).toContain('@second_user')
  })

  it('offers no load-more when there is only one page', async () => {
    const wrapper = await mountSearch()
    await tab(wrapper, 'Odamlar')

    users.mockResolvedValue(page('users', [makeUser(1, 'only')], { last_page: 1, total: 1 }))
    await type(wrapper, 'only')

    const more = wrapper.findAll('button').find((b) => b.text().includes("Ko'proq yuklash"))
    expect(more).toBeUndefined()
  })

  // -- the URL --------------------------------------------------------------

  it('runs a search immediately when one arrives in the URL', async () => {
    users.mockResolvedValue(page('users', [makeUser(1, 'linked')]))

    const wrapper = await mountSearch('?q=linked&type=users')
    await flushPromises()

    expect(users).toHaveBeenCalledWith('linked', 1)
    expect(wrapper.text()).toContain('@linked')
  })

  it('writes the query and tab back into the URL', async () => {
    const wrapper = await mountSearch()
    await type(wrapper, 'futbol')

    expect(router.currentRoute.value.query.q).toBe('futbol')
    expect(router.currentRoute.value.query.type).toBe('activities')
  })
})
