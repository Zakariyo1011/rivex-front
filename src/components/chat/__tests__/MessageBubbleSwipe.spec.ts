import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import MessageBubble from '@/components/chat/MessageBubble.vue'
import type { Message, User } from '@/types'

/**
 * Drag a message sideways to reply to it.
 *
 * These pin the part of the gesture that is a *decision* rather than a
 * rendering: which pointer movements are a reply, which are a scroll, and which
 * are a text selection. Getting that wrong does not look wrong in a screenshot —
 * it shows up as a thread that will not scroll, or a bubble that jumps sideways
 * every time somebody tries to select a word.
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
    id: 5,
    conversation_id: 1,
    body: 'salom',
    type: 'text',
    sender: makeUser(2),
    read_at: null,
    created_at: '2026-08-14T10:30:00.000Z',
    ...overrides,
  } as Message
}

function mountBubble(props: Record<string, unknown> = {}) {
  return mount(MessageBubble, {
    props: { message: makeMessage(), own: false, showTail: true, ...props },
    attachTo: document.body,
    global: { components: { FontAwesomeIcon }, stubs: { RouterLink: true } },
  })
}

/** The element the gesture handlers are bound to: the message column. */
function column(wrapper: VueWrapper): HTMLElement {
  return wrapper.get('p.whitespace-pre-wrap').element.parentElement!.parentElement!
}

/** The element that actually moves — the row wrapping the column. */
function row(wrapper: VueWrapper): HTMLElement {
  return wrapper.get('.group').element as HTMLElement
}

function pointer(
  el: HTMLElement,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  x: number,
  y: number,
  pointerType = 'touch',
) {
  el.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType,
      clientX: x,
      clientY: y,
    }),
  )
}

/** A whole gesture: press at the origin, travel through each point, release. */
async function drag(
  wrapper: VueWrapper,
  points: Array<[number, number]>,
  pointerType = 'touch',
) {
  const el = column(wrapper)
  const [originX, originY] = points[0]!

  pointer(el, 'pointerdown', originX, originY, pointerType)

  for (const [x, y] of points.slice(1)) {
    pointer(el, 'pointermove', x, y, pointerType)
  }

  const [lastX, lastY] = points.at(-1)!
  pointer(el, 'pointerup', lastX, lastY, pointerType)

  await wrapper.vm.$nextTick()
}

/**
 * Select the bubble's text and give the selection a box, since jsdom has no
 * layout of its own and the drag's selection guard is pure geometry.
 */
function selectBubbleText(
  wrapper: VueWrapper,
  rect: { left: number; right: number; top: number; bottom: number },
) {
  const range = document.createRange()
  range.selectNodeContents(wrapper.get('p.whitespace-pre-wrap').element)
  range.getClientRects = () => [rect as DOMRect] as unknown as DOMRectList

  const selection = document.getSelection()!
  selection.removeAllRanges()
  selection.addRange(range)

  return selection
}

beforeEach(() => {
  document.body.style.removeProperty('user-select')
  document.getSelection()?.removeAllRanges()
})

describe('MessageBubble — swipe to reply (touch)', () => {
  it('replies when the message is dragged past the threshold', async () => {
    const message = makeMessage()
    const wrapper = mountBubble({ message })

    await drag(wrapper, [
      [200, 100],
      [180, 102],
      [130, 104],
    ])

    expect(wrapper.emitted('reply')?.[0]).toEqual([message])
  })

  /** Either direction. People reach for both, and refusing one reads as broken. */
  it('replies on a rightward drag as well as a leftward one', async () => {
    const wrapper = mountBubble()

    await drag(wrapper, [
      [100, 100],
      [130, 101],
      [180, 102],
    ])

    expect(wrapper.emitted('reply')).toBeTruthy()
  })

  /**
   * The threshold is the whole point: a gesture that fires on any movement is a
   * gesture you trigger by accident every time you touch the screen.
   */
  it('does not reply when the drag stops short of the threshold', async () => {
    const wrapper = mountBubble()

    await drag(wrapper, [
      [200, 100],
      [185, 101],
      [170, 102],
    ])

    expect(wrapper.emitted('reply')).toBeFalsy()
  })

  it('springs the message back to its place when the drag falls short', async () => {
    const wrapper = mountBubble()

    await drag(wrapper, [
      [200, 100],
      [170, 101],
    ])

    expect(row(wrapper).style.transform).toContain('translate3d(0px, 0, 0)')
  })

  /**
   * 🔴 The failure this guards: a horizontal gesture that claims every pointer
   * makes the thread impossible to scroll, because scrolling a chat means
   * dragging a message.
   */
  it('gives the pointer up to the scroller when the movement is vertical', async () => {
    const wrapper = mountBubble()

    await drag(wrapper, [
      [200, 100],
      [198, 140],
      [120, 220],
    ])

    expect(wrapper.emitted('reply')).toBeFalsy()
    expect(row(wrapper).style.transform).toContain('translate3d(0px, 0, 0)')
  })

  /** Having abandoned the gesture to a scroll, it must stay abandoned. */
  it('does not reclaim the pointer if the finger later turns horizontal', async () => {
    const wrapper = mountBubble()

    await drag(wrapper, [
      [200, 100],
      [200, 150],
      [80, 155],
    ])

    expect(wrapper.emitted('reply')).toBeFalsy()
  })

  it('moves the message while the drag is in progress', async () => {
    const wrapper = mountBubble()
    const el = column(wrapper)

    pointer(el, 'pointerdown', 200, 100)
    pointer(el, 'pointermove', 160, 101)
    await wrapper.vm.$nextTick()

    expect(row(wrapper).style.transform).toContain('translate3d(-40px')
  })

  /** The icon is the only thing that says what the gesture is going to do. */
  it('reveals a reply icon on the side the message is leaving', async () => {
    const wrapper = mountBubble()
    const el = column(wrapper)

    expect(wrapper.find('[aria-hidden="true"]').exists()).toBe(false)

    pointer(el, 'pointerdown', 200, 100)
    pointer(el, 'pointermove', 160, 101)
    await wrapper.vm.$nextTick()

    const icon = wrapper.find('[aria-hidden="true"]')
    expect(icon.exists()).toBe(true)
    expect(icon.classes()).toContain('left-full')
  })

  it('cancels cleanly when the browser takes the pointer away', async () => {
    const wrapper = mountBubble()
    const el = column(wrapper)

    pointer(el, 'pointerdown', 200, 100)
    pointer(el, 'pointermove', 120, 101)
    pointer(el, 'pointercancel', 120, 101)
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('reply')).toBeFalsy()
    expect(row(wrapper).style.transform).toContain('translate3d(0px, 0, 0)')
  })

  /**
   * An optimistic row has no server id to point a reply at, so the gesture must
   * not offer one — `startReply` would refuse it and the drag would be a lie.
   */
  it('refuses the gesture on a message the server has not accepted', async () => {
    const wrapper = mountBubble({ message: makeMessage({ id: -1730000000 }), own: true })

    await drag(wrapper, [
      [200, 100],
      [120, 102],
    ])

    expect(wrapper.emitted('reply')).toBeFalsy()
  })

  it('refuses the gesture on a message that failed to send', async () => {
    const wrapper = mountBubble({ message: makeMessage({ failed: true }), own: true })

    await drag(wrapper, [
      [200, 100],
      [120, 102],
    ])

    expect(wrapper.emitted('reply')).toBeFalsy()
  })

  /** A press that turned into a swipe was never a long press. */
  it('cancels the long-press when the drag claims the pointer', async () => {
    vi.useFakeTimers()

    const wrapper = mountBubble()
    const el = column(wrapper)

    pointer(el, 'pointerdown', 200, 100)
    await vi.advanceTimersByTimeAsync(200)
    pointer(el, 'pointermove', 160, 101)
    await vi.advanceTimersByTimeAsync(600)

    expect(wrapper.emitted('actions')).toBeFalsy()

    vi.useRealTimers()
  })

  /**
   * A pointer sequence that moved still ends in a click. Without swallowing it,
   * dragging a bubble that has reaction badges on it would reply AND toggle a
   * reaction in one gesture.
   */
  it('swallows the click that follows a drag', async () => {
    const wrapper = mountBubble({
      message: makeMessage({ reactions: [{ emoji: '👍', count: 1, user_ids: [9] }] }),
    })
    const el = column(wrapper)

    pointer(el, 'pointerdown', 200, 100)
    pointer(el, 'pointermove', 120, 101)
    pointer(el, 'pointerup', 120, 101)

    wrapper.get('button[aria-pressed]').element.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    )
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('react')).toBeFalsy()
  })

  it('lets an ordinary tap through once the drag is over', async () => {
    const wrapper = mountBubble({
      message: makeMessage({ reactions: [{ emoji: '👍', count: 1, user_ids: [9] }] }),
    })

    await wrapper.get('button[aria-pressed]').trigger('click')

    expect(wrapper.emitted('react')?.[0]?.[1]).toBe('👍')
  })
})

describe('MessageBubble — drag to reply (mouse)', () => {
  it('replies when the mouse is dragged past the threshold', async () => {
    const wrapper = mountBubble()

    await drag(
      wrapper,
      [
        [200, 100],
        [160, 101],
        [120, 102],
      ],
      'mouse',
    )

    expect(wrapper.emitted('reply')).toBeTruthy()
  })

  /**
   * 🔴 On a mouse the competing gesture is SELECTING TEXT, which is horizontal —
   * the same axis. A short horizontal drag is far more likely to be a selection
   * than a reply, so the mouse slop is twice the touch one and a drag inside it
   * must leave the message alone.
   */
  it('ignores a short horizontal mouse drag, which is a text selection', async () => {
    const wrapper = mountBubble()
    const el = column(wrapper)

    pointer(el, 'pointerdown', 200, 100, 'mouse')
    pointer(el, 'pointermove', 176, 100, 'mouse')
    await wrapper.vm.$nextTick()

    expect(row(wrapper).style.transform).toContain('translate3d(0px, 0, 0)')
  })

  /**
   * Pressing INSIDE live selected text means "pick this text up", in every OS.
   * That is the one case the drag has to stand aside for.
   *
   * jsdom lays nothing out, so the selection's rectangles are supplied here —
   * the geometry is the whole subject of the test and there is nothing else to
   * assert against.
   */
  it('stands aside when the press lands on already-selected text', async () => {
    const wrapper = mountBubble()

    const selection = selectBubbleText(wrapper, { left: 150, right: 260, top: 90, bottom: 115 })

    await drag(
      wrapper,
      [
        [200, 100],
        [100, 101],
      ],
      'mouse',
    )

    expect(wrapper.emitted('reply')).toBeFalsy()

    selection.removeAllRanges()
  })

  /**
   * 🔴 Found in browser QA, and the reason the guard above hit-tests a point
   * rather than asking "does a selection exist".
   *
   * Pressing OUTSIDE a selection collapses it — that is what a mouse does. The
   * first version refused the gesture whenever any selection existed anywhere,
   * so the drag worked once and then appeared to break for the rest of the
   * session, because its own previous drag had left text selected.
   */
  it('still drags when the press lands outside an existing selection', async () => {
    const wrapper = mountBubble()

    const selection = selectBubbleText(wrapper, { left: 400, right: 500, top: 300, bottom: 320 })

    await drag(
      wrapper,
      [
        [200, 100],
        [160, 101],
        [120, 102],
      ],
      'mouse',
    )

    expect(wrapper.emitted('reply')).toBeTruthy()

    selection.removeAllRanges()
  })

  /** Right-click opens a context menu; it is not a drag. */
  it('ignores a drag made with a non-primary button', async () => {
    const wrapper = mountBubble()
    const el = column(wrapper)

    el.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        pointerId: 1,
        pointerType: 'mouse',
        button: 2,
        clientX: 200,
        clientY: 100,
      }),
    )
    pointer(el, 'pointermove', 100, 101, 'mouse')
    pointer(el, 'pointerup', 100, 101, 'mouse')
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('reply')).toBeFalsy()
  })

  /** Selection is suppressed for the duration and must be handed back. */
  it('restores text selection after the drag ends', async () => {
    const wrapper = mountBubble()

    await drag(
      wrapper,
      [
        [200, 100],
        [120, 101],
      ],
      'mouse',
    )

    expect(document.body.style.userSelect).toBe('')
  })
})
