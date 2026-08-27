import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MessageComposer from '@/components/chat/MessageComposer.vue'
import type { Message, User } from '@/types'

/**
 * The composer, and the reply bar above it.
 *
 * A reply mode you cannot see is a reply mode you forget you are in, and one
 * you cannot leave is worse — so what this covers is that the bar says who and
 * what, and that there is always a way out of it.
 */
const FontAwesomeIcon = { props: ['icon'], template: '<i />' }

function makeUser(id: number, name = 'Zakariyo'): User {
  return {
    id,
    name,
    display_name: name,
    username: name.toLowerCase(),
    profile: { avatar_url: null, bio: null, age: null, location_name: null },
  } as unknown as User
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 5,
    conversation_id: 1,
    body: 'Salom, yaxshimisan?',
    type: 'text',
    sender: makeUser(2),
    read_at: null,
    created_at: '2026-08-14T10:30:00.000Z',
    ...overrides,
  } as Message
}

function mountComposer(props: Record<string, unknown> = {}) {
  return mount(MessageComposer, {
    props,
    global: { components: { FontAwesomeIcon } },
  })
}

describe('MessageComposer — reply preview', () => {
  it('shows nothing above the field when no reply is in progress', () => {
    const wrapper = mountComposer()

    expect(wrapper.find('button[aria-label="Javobni bekor qilish"]').exists()).toBe(false)
  })

  it('names the person being answered and quotes them', () => {
    const wrapper = mountComposer({ replyingTo: makeMessage() })

    expect(wrapper.text()).toContain('Zakariyo')
    expect(wrapper.text()).toContain('Salom, yaxshimisan?')
  })

  /** The way out. A reply mode with no cancel is a trap. */
  it('offers a cancel that emits', async () => {
    const wrapper = mountComposer({ replyingTo: makeMessage() })

    await wrapper.get('button[aria-label="Javobni bekor qilish"]').trigger('click')

    expect(wrapper.emitted('cancel-reply')).toHaveLength(1)
  })

  /**
   * Two lines, not one and not unbounded. One truncated most real messages
   * mid-word; unbounded would push the field off a phone screen behind the
   * keyboard.
   */
  it('clamps a long quote instead of growing the composer', () => {
    const wrapper = mountComposer({
      replyingTo: makeMessage({ body: 'juda uzun xabar '.repeat(40) }),
    })

    const quote = wrapper.findAll('p').find((p) => p.text().includes('juda uzun xabar'))!

    expect(quote.classes()).toContain('line-clamp-2')
  })

  it('labels a picture rather than quoting its empty body', () => {
    const wrapper = mountComposer({ replyingTo: makeMessage({ body: '', type: 'image' }) })

    expect(wrapper.text()).toContain('Rasm')
  })

  it('sends the typed message', async () => {
    const wrapper = mountComposer()

    await wrapper.get('textarea').setValue('Ha yaxshi')
    await wrapper.get('button[aria-label="Yuborish"]').trigger('click')

    expect(wrapper.emitted('send')?.[0]).toEqual(['Ha yaxshi'])
  })

  it('refuses to send whitespace', async () => {
    const wrapper = mountComposer()

    await wrapper.get('textarea').setValue('   ')
    await wrapper.get('button[aria-label="Yuborish"]').trigger('click')

    expect(wrapper.emitted('send')).toBeFalsy()
  })
})
