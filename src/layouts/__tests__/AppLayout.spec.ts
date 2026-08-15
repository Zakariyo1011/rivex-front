import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { h } from 'vue'
import AppLayout from '@/layouts/AppLayout.vue'

vi.mock('@/stores/notifications', () => ({
  useNotificationsStore: () => ({ subscribe: vi.fn(), unreadCount: 0 }),
}))

/**
 * The notification bell must not appear on screens that draw their own header.
 *
 * It used to be rendered by this layout as `position: fixed; top-4 right-4`,
 * which put it over every screen in the app regardless of what was already in
 * that corner — in practice on top of the conversation header's ⋮ menu, the
 * public profile's ⋮ menu, and the chat list's unread count.
 *
 * The rule is now opt-in: a screen gets the mobile header bar, and therefore
 * the bell, only by filling the `header` slot. These tests pin that direction —
 * opt-out would mean a screen added later silently inherits an overlay on top
 * of its own controls, which is exactly what happened before.
 */
describe('AppLayout', () => {
  beforeEach(() => setActivePinia(createPinia()))

  function mountLayout(slots: Record<string, unknown> = {}) {
    return mount(AppLayout, {
      slots: slots as never,
      global: {
        stubs: {
          Sidebar: { template: '<aside />' },
          BottomNav: { template: '<nav />' },
          NotificationBell: { name: 'NotificationBell', template: '<button data-bell />' },
        },
      },
    })
  }

  it('shows no bell on a screen that draws its own header', () => {
    const wrapper = mountLayout({ default: () => h('div', 'conversation') })

    expect(wrapper.find('[data-bell]').exists()).toBe(false)
  })

  it('shows the bell on a screen that fills the header slot', () => {
    const wrapper = mountLayout({
      header: () => h('h1', 'Suhbatlar'),
      default: () => h('div', 'list'),
    })

    expect(wrapper.find('[data-bell]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Suhbatlar')
  })

  it('renders no header bar at all without the slot', () => {
    const wrapper = mountLayout({ default: () => h('div', 'x') })

    expect(wrapper.find('.tablet\\:hidden.sticky').exists()).toBe(false)
  })

  it('keeps the header bar out of the desktop layout', () => {
    const wrapper = mountLayout({
      header: () => h('h1', 'Suhbatlar'),
      default: () => h('div', 'list'),
    })

    // The bar is mobile-only; the desktop bell lives in the sidebar, which is
    // why it must be hidden rather than duplicated at tablet and above.
    expect(wrapper.find('[data-bell]').element.closest('.tablet\\:hidden')).not.toBeNull()
  })

  it('always renders the default slot', () => {
    expect(mountLayout({ default: () => h('div', 'page body') }).text()).toContain('page body')
  })
})
