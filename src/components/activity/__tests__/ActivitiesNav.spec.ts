import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ActivitiesTabs from '@/components/activity/ActivitiesTabs.vue'
import ActivityRow from '@/components/activity/ActivityRow.vue'
import { bottomNavItems, mainNavItems, activityTabs } from '@/lib/nav'
import { useAuthStore } from '@/stores/auth'
import type { Activity } from '@/types'

const FontAwesomeIcon = { props: ['icon'], template: '<i />' }
const RouterLink = { props: ['to'], template: '<a><slot /></a>' }

let currentRoute = 'explore'

vi.mock('vue-router', () => ({
  RouterLink: { props: ['to'], template: '<a><slot /></a>' },
  useRoute: () => ({ name: currentRoute }),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 1,
    title: 'Kechqurun yugurish',
    category: { id: 1, name: 'Sport', slug: 'sport', icon: null },
    location_name: 'Tashkent',
    start_at: '2026-08-20T18:00:00.000Z',
    people_needed: 3,
    status: 'published',
    owner: { id: 9, name: 'Jasur', display_name: 'Jasur' },
    ...overrides,
  } as unknown as Activity
}

function mountRow(activity: Activity, role?: 'owner' | 'participant') {
  return mount(ActivityRow, {
    props: { activity, role },
    global: {
      components: { FontAwesomeIcon, RouterLink },
      stubs: { StatusBadge: { props: ['status'], template: '<span>{{ status }}</span>' } },
    },
  })
}

function mountTabs(pendingApplications = 0) {
  setActivePinia(createPinia())
  useAuthStore().counters = { pending_applications: pendingApplications }

  return mount(ActivitiesTabs, { global: { components: { FontAwesomeIcon, RouterLink } } })
}

describe('mobile navigation', () => {
  /**
   * The defect this pins: the bottom bar carried Search and neither Explore nor
   * Applications, so the two screens the product is about had no mobile entry
   * point at all.
   */
  it('reaches activities from the mobile bar', () => {
    expect(bottomNavItems.map((i) => i.name)).toContain('explore')
  })

  it('still has exactly five slots including the create button', () => {
    expect(bottomNavItems).toHaveLength(5)
    expect(bottomNavItems.filter((i) => i.action)).toHaveLength(1)
  })

  /** Search lost its slot to Activities; it must remain reachable on desktop. */
  it('keeps search in the sidebar', () => {
    expect(mainNavItems.map((i) => i.name)).toContain('search')
  })

  it('every bottom-bar destination is a real named route in the sidebar or the create action', () => {
    const known = new Set([...mainNavItems.map((i) => i.name), 'activity-create', 'my-activities'])

    for (const item of bottomNavItems) {
      expect(known.has(item.name)).toBe(true)
    }
  })

  it('exposes discover, my activities and applications as the three tabs', () => {
    expect(activityTabs.map((t) => t.name)).toEqual(['explore', 'my-activities', 'applications'])
  })
})

describe('ActivitiesTabs', () => {
  beforeEach(() => {
    currentRoute = 'explore'
    setActivePinia(createPinia())
  })

  it('renders all three tabs', () => {
    expect(mountTabs().findAll('a')).toHaveLength(3)
  })

  it('marks the current route as the active tab', () => {
    currentRoute = 'my-activities'
    const wrapper = mountTabs()

    const active = wrapper.findAll('[aria-current="page"]')
    expect(active).toHaveLength(1)
    expect(active[0]!.text()).toContain('nav.myActivities')
  })

  it('badges applications with the pending count from /me', () => {
    const wrapper = mountTabs(4)

    expect(wrapper.find('[aria-label*="kutilmoqda"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('4')
  })

  it('shows no badge at zero', () => {
    expect(mountTabs(0).find('[aria-label*="kutilmoqda"]').exists()).toBe(false)
  })

  it('caps a large count', () => {
    expect(mountTabs(180).text()).toContain('99+')
  })

  /** A signed-out or not-yet-loaded shell must not throw or render a zero. */
  it('survives counters being absent', () => {
    setActivePinia(createPinia())
    useAuthStore().counters = null

    const wrapper = mount(ActivitiesTabs, {
      global: { components: { FontAwesomeIcon, RouterLink } },
    })

    expect(wrapper.find('[aria-label*="kutilmoqda"]').exists()).toBe(false)
  })
})

describe('ActivityRow', () => {
  it('shows the activity and its status', () => {
    const wrapper = mountRow(makeActivity({ status: 'completed' }))

    expect(wrapper.text()).toContain('Kechqurun yugurish')
    expect(wrapper.text()).toContain('completed')
  })

  it('offers the organiser a way into the waiting applications', () => {
    const wrapper = mountRow(makeActivity({ pending_applications_count: 3 }), 'owner')

    expect(wrapper.text()).toContain('3 ta yangi ariza')
    expect(wrapper.text()).toContain('Siz tashkilotchisiz')
  })

  it('says nothing about applications when none are waiting', () => {
    const wrapper = mountRow(makeActivity({ pending_applications_count: 0 }), 'owner')

    expect(wrapper.text()).not.toContain('yangi ariza')
  })

  /**
   * The count is owner-only on the server, so a participant row should never
   * have one — and must not render the organiser's call to action even if a
   * payload somehow carried it.
   */
  it('never shows the pending count to a participant', () => {
    const wrapper = mountRow(makeActivity({ pending_applications_count: 3 }), 'participant')

    expect(wrapper.text()).not.toContain('yangi ariza')
    expect(wrapper.text()).toContain('Siz ishtirokchisiz')
  })

  it('shows no role line when the list does not distinguish one', () => {
    const wrapper = mountRow(makeActivity())

    expect(wrapper.text()).not.toContain('Siz tashkilotchisiz')
    expect(wrapper.text()).not.toContain('Siz ishtirokchisiz')
  })
})
