import { describe, it, expect, vi } from 'vitest'
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
    //
    // Asserted against the BUBBLE'S OWN classes rather than the whole subtree.
    // The bubble now sits beside hover-revealed reply and react controls, and
    // those legitimately use `hover:bg-surface-muted` for their hover fill — a
    // substring search over the rendered HTML cannot tell that apart from the
    // bubble being painted with it, and would fail on a component that is
    // correct. Narrowing the target keeps the regression covered; loosening the
    // assertion would not have.
    const bubble = wrapper.get('p.whitespace-pre-wrap').element.parentElement!
    const classes = Array.from(bubble.classList)

    expect(classes).toContain('bg-surface')
    expect(classes).not.toContain('bg-surface-muted')
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

    // The reason and the actions are separate elements now — a failed send says
    // WHY before it offers a way out, because being blocked, being rate limited
    // and being offline call for different reactions from the sender.
    const retry = wrapper.findAll('button').find((b) => b.text() === 'Qayta urinish')
    expect(retry).toBeTruthy()

    await retry!.trigger('click')
    expect(wrapper.emitted('retry')?.[0]).toEqual([message])
  })

  /**
   * 🔴 The regression this pins.
   *
   * Every failed send rendered the same bare "Yuborilmadi" — including the one
   * that surfaced when the websocket server was unreachable and the message had
   * actually been saved. The sender is now told which kind of failure it was.
   */
  it('shows why the send failed when the reason is known', () => {
    const wrapper = mountBubble({
      message: makeMessage({ failed: true, failed_reason: 'Juda ko‘p urinish.' }),
      own: true,
    })

    expect(wrapper.text()).toContain('Juda ko‘p urinish.')
  })

  it('falls back to a plain statement when no reason was captured', () => {
    const wrapper = mountBubble({ message: makeMessage({ failed: true }), own: true })

    expect(wrapper.text()).toContain('Yuborilmadi.')
  })

  /** A failed message must be dismissable, not stuck in the thread forever. */
  it('offers to discard a failed message', async () => {
    const message = makeMessage({ failed: true })
    const wrapper = mountBubble({ message, own: true })

    const discard = wrapper.findAll('button').find((b) => b.text() === "O'chirish")
    expect(discard).toBeTruthy()

    await discard!.trigger('click')
    expect(wrapper.emitted('discard')?.[0]).toEqual([message])
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

/**
 * Replies and reactions, as the bubble renders them.
 *
 * The store's tests cover what a reply and a reaction *are*; these cover the
 * two things only the component can get wrong — quoting the original in a way
 * the reader can act on, and offering the actions without spending permanent
 * screen width on them.
 */
describe('MessageBubble — replies', () => {
  function withReply(overrides: Record<string, unknown> = {}) {
    return mountBubble({
      message: makeMessage({
        id: 6,
        body: 'Ha, boramiz.',
        reply_to: {
          id: 5,
          deleted: false,
          body: 'Bugun soat 20:00 da boramizmi?',
          type: 'text',
          sender: makeUser(3, 'Azizbek'),
        },
      }),
      own: false,
      ...overrides,
    })
  }

  it('quotes the original above the reply', () => {
    const html = withReply().html()

    expect(html).toContain('Azizbek')
    expect(html).toContain('Bugun soat 20:00 da boramizmi?')
    // And the reply's own text is still there — a quote that replaces the
    // message would be worse than no quote.
    expect(html).toContain('Ha, boramiz.')
  })

  /** Tapping the quote is how a reader follows a branched conversation. */
  it('asks to jump to the original when the quote is tapped', async () => {
    const wrapper = withReply()

    await wrapper.get('button[type="button"]').trigger('click')

    expect(wrapper.emitted('jump')?.[0]).toEqual([5])
  })

  /**
   * A reply outlives the message it answered — the foreign key nulls rather
   * than cascading. The quote then has to say so rather than render blank.
   */
  it('says the original is gone rather than rendering an empty quote', () => {
    const wrapper = mountBubble({
      message: makeMessage({
        id: 6,
        reply_to: { id: null, deleted: true, body: null, type: null, sender: null },
      }),
      own: false,
    })

    expect(wrapper.html()).toContain("Xabar o'chirilgan")
  })

  it('does not offer to jump to an original that is gone', async () => {
    const wrapper = mountBubble({
      message: makeMessage({
        id: 6,
        reply_to: { id: null, deleted: true, body: null, type: null, sender: null },
      }),
      own: false,
    })

    const quote = wrapper.get('button[type="button"]')
    expect(quote.attributes('disabled')).toBeDefined()
  })

  it('renders no quote at all for an ordinary message', () => {
    expect(mountBubble({ message: makeMessage(), own: false }).html()).not.toContain('ga javob')
  })
})

describe('MessageBubble — reactions', () => {
  const groups = [
    { emoji: '👍', count: 3, user_ids: [1, 2, 3] },
    { emoji: '❤️', count: 1, user_ids: [4] },
  ]

  it('shows a badge per emoji with its count', () => {
    const html = mountBubble({
      message: makeMessage({ reactions: groups }),
      own: false,
    }).html()

    expect(html).toContain('👍')
    expect(html).toContain('3')
    expect(html).toContain('❤️')
  })

  /** The viewer's own reaction has to be distinguishable from everyone else's. */
  it('marks the viewers own reaction as pressed', () => {
    const wrapper = mountBubble({
      message: makeMessage({ reactions: groups }),
      own: false,
      myReaction: '👍',
    })

    const badges = wrapper.findAll('button[aria-pressed]')
    const mine = badges.find((b) => b.attributes('aria-label')?.startsWith('👍'))
    const theirs = badges.find((b) => b.attributes('aria-label')?.startsWith('❤️'))

    expect(mine?.attributes('aria-pressed')).toBe('true')
    expect(theirs?.attributes('aria-pressed')).toBe('false')
  })

  /** Tapping a badge is the fast path — agreeing with somebody needs no picker. */
  it('toggles the reaction when a badge is tapped', async () => {
    const wrapper = mountBubble({
      message: makeMessage({ id: 5, reactions: groups }),
      own: false,
    })

    const badge = wrapper
      .findAll('button[aria-pressed]')
      .find((b) => b.attributes('aria-label')?.startsWith('👍'))!

    await badge.trigger('click')

    expect(wrapper.emitted('react')?.[0]?.[1]).toBe('👍')
  })

  /**
   * 🔴 THE REGRESSION THIS PINS.
   *
   * The badge row used to be a sibling *below* the bubble. At a glance that is
   * not "a reaction on this message" — it is a second, smaller, unexplained
   * message hanging underneath the first one, which is exactly how it was
   * reported. A reaction is a property of a message, and the only unambiguous
   * way to say so is to draw it within the message's own bounds.
   *
   * Asserted as containment rather than by class, because the bug was
   * structural: any amount of margin tweaking on a sibling still leaves it a
   * sibling, and a CSS-only fix would pass a class assertion while looking
   * exactly as wrong.
   */
  it('draws the badges inside the bubble, not as a row hanging below it', () => {
    const wrapper = mountBubble({ message: makeMessage({ reactions: groups }), own: false })

    const bubble = wrapper.get('p.whitespace-pre-wrap').element.parentElement!
    const badge = wrapper.get('button[aria-pressed]').element

    expect(bubble.contains(badge)).toBe(true)
  })

  it('keeps the badges inside an outgoing bubble too', () => {
    const wrapper = mountBubble({ message: makeMessage({ reactions: groups }), own: true })

    const bubble = wrapper.get('p.whitespace-pre-wrap').element.parentElement!

    expect(bubble.contains(wrapper.get('button[aria-pressed]').element)).toBe(true)
  })

  /**
   * The badges sit in normal flow inside the bubble. Absolute positioning was
   * the other way to attach them, and it is the way that lets a popular message
   * reach out over its neighbours — the bubble's own box has to contain them.
   */
  it('positions the badges in flow rather than out of it', () => {
    const wrapper = mountBubble({ message: makeMessage({ reactions: groups }), own: false })
    const badgeRow = wrapper.get('button[aria-pressed]').element.parentElement!

    expect(Array.from(badgeRow.classList)).not.toContain('absolute')
    expect(Array.from(badgeRow.classList)).toContain('flex-wrap')
  })

  /** A four-digit count would stretch one badge until the row wrapped twice. */
  it('clamps a very large count instead of widening the badge', () => {
    const wrapper = mountBubble({
      message: makeMessage({ reactions: [{ emoji: '😂', count: 1240, user_ids: [1] }] }),
      own: false,
    })

    expect(wrapper.get('button[aria-pressed]').text()).toContain('99+')
    // The true count still reaches assistive tech, which has room for it.
    expect(wrapper.get('button[aria-pressed]').attributes('aria-label')).toContain('1240')
  })

  it('wraps a full set of reactions rather than overflowing the bubble', () => {
    const wrapper = mountBubble({
      message: makeMessage({
        body: 'ok',
        reactions: [
          { emoji: '❤️', count: 12, user_ids: [1] },
          { emoji: '😂', count: 3, user_ids: [2] },
          { emoji: '👍', count: 8, user_ids: [3] },
          { emoji: '😮', count: 1, user_ids: [4] },
          { emoji: '😢', count: 5, user_ids: [5] },
        ],
      }),
      own: false,
    })

    expect(wrapper.findAll('button[aria-pressed]')).toHaveLength(5)
    expect(wrapper.get('button[aria-pressed]').element.parentElement!.classList).toContain(
      'flex-wrap',
    )
  })

  /**
   * A reply and a reaction on the same message is the ordinary case, not an
   * edge one, and the quote must not be pushed out by the badges or vice versa.
   */
  it('renders a quote and a badge row together on one message', () => {
    const wrapper = mountBubble({
      message: makeMessage({
        reactions: groups,
        reply_to: {
          id: 4,
          deleted: false,
          body: 'Asl xabar',
          type: 'text',
          sender: makeUser(3, 'Azizbek'),
        },
      }),
      own: false,
    })

    const bubble = wrapper.get('p.whitespace-pre-wrap').element.parentElement!

    expect(wrapper.text()).toContain('Asl xabar')
    expect(bubble.contains(wrapper.get('button[aria-pressed]').element)).toBe(true)
  })

  it('renders no badge row when nobody has reacted', () => {
    const wrapper = mountBubble({ message: makeMessage({ reactions: [] }), own: false })

    expect(wrapper.findAll('button[aria-pressed]')).toHaveLength(0)
  })

  /**
   * An optimistic row has no server id, so it can be neither replied to nor
   * reacted to — a reaction addressed to a negative id would 404.
   */
  it('offers no actions on a message the server has not accepted yet', () => {
    const wrapper = mountBubble({
      message: makeMessage({ id: -1730000000 }),
      own: true,
    })

    expect(wrapper.html()).not.toContain('Javob berish')
    expect(wrapper.html()).not.toContain("Reaksiya qo'shish")
  })

  it('offers reply and react on a real message', () => {
    const html = mountBubble({ message: makeMessage({ id: 5 }), own: false }).html()

    expect(html).toContain('Javob berish')
    expect(html).toContain("Reaksiya qo'shish")
  })

  it('emits reply with the message when the reply action is used', async () => {
    const wrapper = mountBubble({ message: makeMessage({ id: 5 }), own: false })

    await wrapper.get('button[aria-label="Javob berish"]').trigger('click')

    expect(wrapper.emitted('reply')?.[0]?.[0]).toMatchObject({ id: 5 })
  })

  /**
   * 🔴 A long press on a touch screen must reach the mobile sheet, not the
   * floating desktop picker — see MessageActionSheet for why the floating row
   * cannot work on a phone.
   */
  it('asks for the action sheet on a touch long-press', async () => {
    vi.useFakeTimers()

    const message = makeMessage({ id: 5 })
    const wrapper = mountBubble({ message, own: false })
    const bubble = wrapper.get('p.whitespace-pre-wrap').element.parentElement!

    bubble.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        pointerType: 'touch',
        clientX: 10,
        clientY: 10,
      }),
    )

    await vi.advanceTimersByTimeAsync(600)

    expect(wrapper.emitted('actions')?.[0]).toEqual([message])
    // And NOT the floating picker, which would open off-screen on a phone.
    expect(wrapper.find('[aria-label="Reaksiya tanlang"]').exists()).toBe(false)

    vi.useRealTimers()
  })

  /** A mouse gets hover controls, so a long press with one must do nothing. */
  it('ignores a long-press made with a mouse', async () => {
    vi.useFakeTimers()

    const wrapper = mountBubble({ message: makeMessage({ id: 5 }), own: false })
    const bubble = wrapper.get('p.whitespace-pre-wrap').element.parentElement!

    bubble.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        pointerType: 'mouse',
        clientX: 10,
        clientY: 10,
      }),
    )

    await vi.advanceTimersByTimeAsync(600)

    expect(wrapper.emitted('actions')).toBeFalsy()

    vi.useRealTimers()
  })

  it('opens the picker from the react action', async () => {
    const wrapper = mountBubble({ message: makeMessage({ id: 5 }), own: false })

    expect(wrapper.find('[aria-label="Reaksiya tanlang"]').exists()).toBe(false)

    await wrapper.get('button[aria-label="Reaksiya qo\'shish"]').trigger('click')

    expect(wrapper.find('[aria-label="Reaksiya tanlang"]').exists()).toBe(true)
  })
})
