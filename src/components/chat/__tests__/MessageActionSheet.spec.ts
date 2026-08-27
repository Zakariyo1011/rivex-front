import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MessageActionSheet from '@/components/chat/MessageActionSheet.vue'
import { MESSAGE_REACTIONS } from '@/types'

const FontAwesomeIcon = { props: ['icon'], template: '<i />' }

function mountSheet(props: Record<string, unknown> = {}) {
  return mount(MessageActionSheet, {
    props: { preview: 'Bugun soat 20:00 da boramizmi?', ...props },
    global: { components: { FontAwesomeIcon } },
    attachTo: document.body,
  })
}

/**
 * The mobile half of the message actions.
 *
 * The desktop hover controls and floating picker do not survive a touch screen:
 * there is no hover to reveal them, and a row anchored to a bubble near the top
 * or the right edge opens off-screen. The sheet is bottom-anchored, so it is
 * always reachable and can never be positioned outside the viewport.
 */
describe('MessageActionSheet', () => {
  it('offers every reaction as a thumb-sized target', () => {
    const wrapper = mountSheet()
    const buttons = wrapper.findAll('button[aria-pressed]')

    expect(buttons).toHaveLength(MESSAGE_REACTIONS.length)
    MESSAGE_REACTIONS.forEach((emoji) => {
      expect(wrapper.text()).toContain(emoji)
    })
  })

  it('says which message it is acting on', () => {
    expect(mountSheet().text()).toContain('Bugun soat 20:00 da boramizmi?')
  })

  it('marks the viewers current reaction as chosen', () => {
    const wrapper = mountSheet({ current: '👍' })
    const chosen = wrapper
      .findAll('button[aria-pressed]')
      .find((b) => b.attributes('aria-label') === '👍')

    expect(chosen?.attributes('aria-pressed')).toBe('true')
  })

  it('emits the chosen reaction', async () => {
    const wrapper = mountSheet()
    const heart = wrapper
      .findAll('button[aria-pressed]')
      .find((b) => b.attributes('aria-label') === '❤️')!

    await heart.trigger('click')

    expect(wrapper.emitted('react')?.[0]).toEqual(['❤️'])
  })

  it('offers reply', async () => {
    const wrapper = mountSheet()
    const reply = wrapper.findAll('button').find((b) => b.text().includes('Javob berish'))!

    await reply.trigger('click')

    expect(wrapper.emitted('reply')).toBeTruthy()
  })

  /** The backdrop is the primary way out on a phone. */
  it('closes when the backdrop is tapped', async () => {
    const wrapper = mountSheet()

    await wrapper.find('.bg-black\\/40').trigger('click')

    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('closes on escape', async () => {
    const wrapper = mountSheet()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('close')).toBeTruthy()
  })

  /**
   * The sheet covers the thread; letting the thread scroll under it is how a
   * dismissal ends up somewhere unexpected.
   */
  it('locks the page scroll while open and restores it on close', () => {
    const wrapper = mountSheet()
    expect(document.body.style.overflow).toBe('hidden')

    wrapper.unmount()
    expect(document.body.style.overflow).toBe('')
  })

  /** Desktop reaches the same two actions on hover; the sheet is phone-only. */
  it('is hidden above the mobile breakpoint', () => {
    expect(mountSheet().html()).toContain('tablet:hidden')
  })
})
