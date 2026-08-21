import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import BottomNav from '@/components/layout/BottomNav.vue'
import Sidebar from '@/components/layout/Sidebar.vue'
import { useChatStore } from '@/stores/chat'

/**
 * The unread chat count, on both breakpoints.
 *
 * It existed on the bottom nav and **not** in the sidebar, so the same account
 * showed a count on a phone and nothing at all on a laptop. Both now read the
 * same store — which is the point, since two sources are how a badge starts
 * disagreeing with the screen it points at.
 */
vi.mock('@/api/conversations', () => ({
  conversationsApi: { list: vi.fn().mockResolvedValue({ data: { data: [], meta: {} } }) },
}))

const FontAwesomeIcon = { props: ['icon'], template: '<i />' }
const RouterLink = { props: ['to'], template: '<a><slot /></a>' }

vi.mock('vue-router', () => ({
  RouterLink: { props: ['to'], template: '<a><slot /></a>' },
  useRoute: () => ({ name: 'home' }),
}))

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

function mountNav(component: typeof BottomNav | typeof Sidebar, unread: number) {
  setActivePinia(createPinia())
  useChatStore().totalUnread = unread

  return mount(component, {
    global: {
      components: { FontAwesomeIcon, RouterLink },
      stubs: {
        NotificationBell: { template: '<button />' },
        Avatar: { props: ['src', 'name', 'size'], template: '<span />' },
      },
    },
  })
}

describe('the chat unread badge', () => {
  beforeEach(() => setActivePinia(createPinia()))

  describe.each([
    ['BottomNav (375px)', BottomNav],
    ['Sidebar (1280px)', Sidebar],
  ])('%s', (_label, component) => {
    it('renders the count when there is something unread', () => {
      const wrapper = mountNav(component as typeof BottomNav, 3)

      expect(wrapper.find('[aria-label*="o‘qilmagan"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('3')
    })

    it('renders nothing at zero', () => {
      const wrapper = mountNav(component as typeof BottomNav, 0)

      expect(wrapper.find('[aria-label*="o‘qilmagan"]').exists()).toBe(false)
    })

    it('caps a very large count', () => {
      const wrapper = mountNav(component as typeof BottomNav, 250)

      expect(wrapper.text()).toContain('99+')
    })
  })
})
