import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { defineComponent, h } from 'vue'
import ActivityCard from '@/components/activity/ActivityCard.vue'
import type { Activity, ActivityStatus } from '@/types'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: { template: '<div />' } },
    { path: '/activities/:id', name: 'activity-detail', component: { template: '<div />' } },
  ],
})

const FaStub = defineComponent({ setup: () => () => h('i') })

function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 1,
    title: 'PS5 turnir',
    description: null,
    category: { id: 1, name: 'Gaming', slug: 'gaming', icon: null, parent_id: null },
    location_name: 'PS Arena',
    latitude: null,
    longitude: null,
    start_at: '2027-01-01T18:00:00Z',
    ends_at: '2027-01-01T20:00:00Z',
    duration_minutes: 120,
    people_needed: 2,
    payment_type: 'free',
    amount: 0,
    status: 'published',
    owner_confirmed_completed_at: null,
    cancellation_reason: null,
    cancellation_note: null,
    cancelled_at: null,
    cancelled_late: false,
    owner: {
      id: 9,
      name: 'Zakariyo',
      display_name: 'Zakariyo',
      username: 'zakariyo',
      phone_verified: true,
      identity_verified: false,
      verification_status: 'not_verified',
      status: 'active',
      profile: { avatar_url: null, bio: null, age: null, location_name: null },
      created_at: '2026-01-01T00:00:00Z',
    },
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as Activity
}

function mountCard(props: Record<string, unknown>) {
  return mount(ActivityCard, {
    props: props as never,
    global: { plugins: [router], stubs: { FontAwesomeIcon: FaStub } },
  })
}

/**
 * The card is what Home, Explore and every activity grid render.
 *
 * 🔴 It carried no status badge at all. `ActivityRow` — the list row on My
 * Activities — has had one since it was written, so a completed activity looked
 * finished in one list and identical to a live one in every other. That is the
 * "completed does not show" report, seen from the component that caused it.
 */
describe('ActivityCard', () => {
  it('says nothing about the status of an ordinary open activity', () => {
    const wrapper = mountCard({ activity: activity() })

    // A badge on every card in Explore is noise that teaches people to stop
    // reading badges.
    expect(wrapper.text()).not.toContain("E'lon qilingan")
  })

  it.each<[ActivityStatus, string]>([
    ['completed', 'Yakunlangan'],
    ['cancelled', 'Bekor qilingan'],
    ['expired', "Muddati o'tgan"],
    ['full', "To'lgan"],
    ['in_progress', 'Davom etmoqda'],
  ])('labels a %s activity as "%s"', (status, label) => {
    expect(mountCard({ activity: activity({ status }) }).text()).toContain(label)
  })

  it('labels the status on the compact card too', () => {
    const wrapper = mountCard({ activity: activity({ status: 'completed' }), compact: true })

    expect(wrapper.text()).toContain('Yakunlangan')
  })

  /**
   * Only a distance measured from the activity's own pin is exact. Anything
   * derived from a district or region centre is marked, because a confident
   * "1.2 km" computed from a regional capital is a worse answer than "~1.2 km".
   */
  it('marks a distance that was inferred from an area centre', () => {
    const exact = mountCard({ activity: activity({ distance_km: 1.2 }) })
    const approx = mountCard({
      activity: activity({ distance_km: 1.2, distance_approximate: true }),
    })

    expect(exact.text()).toContain('1.2 km')
    expect(exact.text()).not.toContain('~1.2 km')
    expect(approx.text()).toContain('~1.2 km')
  })
})
