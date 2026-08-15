import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MessageBubble from '@/components/chat/MessageBubble.vue'
import type { Message, User } from '@/types'

/**
 * Incoming and outgoing must not look alike.
 *
 * The bug these tests pin: an incoming bubble was `bg-surface-muted`, which is
 * the token the page background uses — so incoming text sat on a bubble exactly
 * the colour of the page and read as bare, colourless text, while outgoing was
 * solid violet. The two were not "weakly distinguished"; one of them was
 * invisible. Asserting on the classes is crude but it is the only part of a
 * colour decision a unit test can hold onto.
 */
const FontAwesomeIcon = { props: ['icon'], template: '<i />' }

function makeUser(id: number, name = 'Jasur'): User {
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
    id: 1,
    conversation_id: 1,
    body: 'salom',
    type: 'text',
    sender: makeUser(2),
    read_at: null,
    created_at: '2026-08-14T10:30:00.000Z',
    ...overrides,
  } as Message
}

function mountBubble(props: Record<string, unknown>) {
  return mount(MessageBubble, {
    props: { showTail: true, ...props },
    global: { components: { FontAwesomeIcon }, stubs: { RouterLink: true } },
  })
}

describe('MessageBubble', () => {
  it('gives an outgoing message the solid accent fill', () => {
    const wrapper = mountBubble({ message: makeMessage(), own: true })

    expect(wrapper.html()).toContain('bg-primary-600')
  })

  it('gives an incoming message a surface card, never the page background', () => {
    const wrapper = mountBubble({ message: makeMessage(), own: false })
    const html = wrapper.html()

    expect(html).toContain('bg-surface')
    expect(html).not.toContain('bg-primary-600')

    // The regression itself: `bg-surface-muted` is the page background token.
    // An incoming bubble painted with it is invisible.
    expect(html).not.toContain('bg-surface-muted')
  })

  it('renders incoming and outgoing on opposite sides', () => {
    expect(mountBubble({ message: makeMessage(), own: true }).html()).toContain('flex-row-reverse')
    expect(mountBubble({ message: makeMessage(), own: false }).html()).not.toContain(
      'flex-row-reverse',
    )
  })

  it('always shows a timestamp', () => {
    const wrapper = mountBubble({ message: makeMessage(), own: false })

    expect(wrapper.text()).toMatch(/\d{2}:\d{2}/)
  })

  it('shows a single tick for a delivered message and a double for a read one', () => {
    const delivered = mountBubble({ message: makeMessage(), own: true })
    expect(delivered.find('[aria-label="Yuborildi"]').exists()).toBe(true)
    expect(delivered.find('[aria-label="O\'qildi"]').exists()).toBe(false)

    const read = mountBubble({
      message: makeMessage({ read_at: '2026-08-14T10:31:00.000Z' }),
      own: true,
    })
    expect(read.find('[aria-label="O\'qildi"]').exists()).toBe(true)
  })

  it('never shows a delivery state on somebody else’s message', () => {
    const wrapper = mountBubble({ message: makeMessage(), own: false })

    expect(wrapper.find('[aria-label="Yuborildi"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="Yuborilmoqda"]').exists()).toBe(false)
  })

  it('marks a pending message and shows no tick yet', () => {
    const wrapper = mountBubble({ message: makeMessage({ pending: true }), own: true })

    expect(wrapper.html()).toContain('opacity-60')
    expect(wrapper.find('[aria-label="Yuborilmoqda"]').exists()).toBe(true)
  })

  it('offers a retry on a failed message and emits it', async () => {
    const message = makeMessage({ failed: true })
    const wrapper = mountBubble({ message, own: true })

    const retry = wrapper.find('button')
    expect(retry.text()).toContain('Yuborilmadi')

    await retry.trigger('click')
    expect(wrapper.emitted('retry')?.[0]).toEqual([message])
  })

  it('names the sender in a group thread but not in a direct one', () => {
    const message = makeMessage({ sender: makeUser(2, 'Aziz') })

    expect(mountBubble({ message, own: false, showSender: true }).text()).toContain('Aziz')
    expect(mountBubble({ message, own: false, showSender: false }).text()).not.toContain('Aziz')
  })

  it('wraps long unbroken text instead of letting it stretch the bubble', () => {
    const wrapper = mountBubble({
      message: makeMessage({ body: 'a'.repeat(400) }),
      own: false,
    })

    expect(wrapper.html()).toContain('break-words')
  })

  it('preserves the line breaks a multiline message was written with', () => {
    const wrapper = mountBubble({ message: makeMessage({ body: 'bir\nikki' }), own: false })

    expect(wrapper.html()).toContain('whitespace-pre-wrap')
  })
})
