import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import HomeView from '@/views/home/HomeView.vue'
import { bottomNavItems, mainNavItems } from '@/lib/nav'

vi.mock('@/api/activities', () => ({
  activitiesApi: { list: () => Promise.resolve({ data: { data: [] } }) },
}))

vi.mock('@/api/categories', () => ({
  categoriesApi: { list: () => Promise.resolve({ data: { data: [] } }) },
}))

vi.mock('@/layouts/AppLayout.vue', () => ({
  default: defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) }),
}))

vi.mock('@/components/verification/VerificationBanner.vue', () => ({
  default: defineComponent({ setup: () => () => h('div') }),
}))

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: { template: '<div />' } },
    { path: '/search', name: 'search', component: { template: '<div />' } },
    { path: '/explore', name: 'explore', component: { template: '<div />' } },
    { path: '/profile', name: 'profile', component: { template: '<div />' } },
  ],
})

/**
 * Mobile's route into global search.
 *
 * 🔴 The bottom bar has four slots and gave search's up, on the explicit
 * grounds that "Home opens with a full-width search field". That field routed
 * to **Explore**, which browses activities and cannot find a person — so the
 * one screen that finds people had no mobile entry point at all. It was not
 * hidden by CSS and not blocked by a guard; nothing linked to it.
 *
 * Two things had to become true, and both are pinned here: the bar's trade-off
 * has to be honest about what replaces search, and Home's field has to actually
 * open search.
 */
describe('Home search entry', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it("opens search, not Explore, from Home's search field", async () => {
    await router.push('/')
    await router.isReady()

    const wrapper = mount(HomeView, {
      global: { plugins: [router], stubs: { FontAwesomeIcon: { template: '<i />' } } },
    })
    await flushPromises()

    const field = wrapper
      .findAll('button')
      .find((b) => b.text().includes('Nima qilmoqchisiz'))!

    expect(field.exists()).toBe(true)

    await field.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('search')
  })

  it('keeps search in the desktop navigation', () => {
    expect(mainNavItems.map((i) => i.name)).toContain('search')
  })

  /**
   * Not a regression guard on the layout so much as on the reasoning: if
   * somebody puts search back into the four-slot bar, they have to decide which
   * of these loses its place, and this test is where that decision surfaces.
   */
  it('keeps the mobile bar to its four destinations plus the create action', () => {
    expect(bottomNavItems.filter((i) => !i.action).map((i) => i.name)).toEqual([
      'home',
      'explore',
      'chats',
      'profile',
    ])
  })
})
