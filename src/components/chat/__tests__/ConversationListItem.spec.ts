import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ConversationListItem from '@/components/chat/ConversationListItem.vue'
import { useAuthStore } from '@/stores/auth'
import type { Conversation, User } from '@/types'

/**
 * A conversation row names a person, not an activity.
 *
 * The row this replaces put the person's name on the first line and the
 * *activity title* on the second, which is how four activities with one person
 * read as four different chats — and is the surface symptom of the identity bug
 * this phase fixes underneath.
 */
const FontAwesomeIcon = { props: ['icon'], template: '<i />' }
const RouterLink = { props: ['to'], template: '<a><slot /></a>' }

function makeUser(id: number, name: string): User {
  return {
    id,
    name,
    display_name: name,
    username: name.toLowerCase(),
    profile: { avatar_url: null, bio: null, age: null, location_name: null },
  } as unknown as User
}

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 1,
    type: 'direct',
    counterpart: makeUser(2, 'Jasur'),
    activity: null,
    last_message: null,
    last_message_at: null,
    unread_count: 0,
    created_at: '2026-08-14T09:00:00.000Z',
    ...overrides,
  } as Conversation
}

function mountRow(conversation: Conversation) {
  return mount(ConversationListItem, {
    props: { conversation },
    global: { components: { FontAwesomeIcon, RouterLink } },
  })
}

describe('ConversationListItem', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useAuthStore().user = makeUser(1, 'Zakariyo')
  })

  it('titles a direct conversation with the other person', () => {
    expect(mountRow(makeConversation()).text()).toContain('Jasur')
  })

  it('titles a group conversation with its activity', () => {
    const wrapper = mountRow(
      makeConversation({
        type: 'activity',
        counterpart: null,
        activity: { id: 9, title: 'Futbol' } as Conversation['activity'],
      }),
    )

    expect(wrapper.text()).toContain('Futbol')
  })

  it('previews the last message rather than an activity name', () => {
    const wrapper = mountRow(
      makeConversation({
        last_message: {
          id: 5,
          conversation_id: 1,
          body: 'ertaga boramizmi',
          type: 'text',
          sender: makeUser(2, 'Jasur'),
          created_at: '2026-08-14T09:05:00.000Z',
        } as Conversation['last_message'],
        last_message_at: '2026-08-14T09:05:00.000Z',
      }),
    )

    expect(wrapper.text()).toContain('ertaga boramizmi')
  })

  it('marks your own last message so it does not read as theirs', () => {
    const wrapper = mountRow(
      makeConversation({
        last_message: {
          id: 5,
          conversation_id: 1,
          body: 'men yozdim',
          type: 'text',
          sender: makeUser(1, 'Zakariyo'),
          created_at: '2026-08-14T09:05:00.000Z',
        } as Conversation['last_message'],
        last_message_at: '2026-08-14T09:05:00.000Z',
      }),
    )

    expect(wrapper.text()).toContain('Siz: men yozdim')
  })

  it('invites the user to start when there is nothing to preview', () => {
    expect(mountRow(makeConversation()).text()).toContain('Suhbatni boshlang')
  })

  it('shows an unread badge only when there is something unread', () => {
    expect(mountRow(makeConversation({ unread_count: 3 })).text()).toContain('3')
    expect(
      mountRow(makeConversation({ unread_count: 0 })).find('[aria-label*="o‘qilmagan"]').exists(),
    ).toBe(false)
  })

  it('caps a very large unread count', () => {
    expect(mountRow(makeConversation({ unread_count: 250 })).text()).toContain('99+')
  })

  it('links to the conversation by conversation id', () => {
    const wrapper = mountRow(makeConversation({ id: 42 }))

    expect(wrapper.findComponent(RouterLink).props('to')).toEqual({
      name: 'chat-detail',
      params: { conversationId: 42 },
    })
  })

  // -- online status --------------------------------------------------------

  /**
   * The dot is rendered from `is_online`, which the server resolves behind the
   * `show_online_status` gate. The row decides nothing — a client-side rule
   * here would be a second privacy authority.
   */
  it('shows an online dot when the server says the person is online', () => {
    const wrapper = mountRow(
      makeConversation({ counterpart: { ...makeUser(2, 'Jasur'), is_online: true } }),
    )

    expect(wrapper.find('[data-testid="online-dot"]').exists()).toBe(true)
  })

  it('shows no dot when the person is offline', () => {
    const wrapper = mountRow(
      makeConversation({ counterpart: { ...makeUser(2, 'Jasur'), is_online: false } }),
    )

    expect(wrapper.find('[data-testid="online-dot"]').exists()).toBe(false)
  })

  /** Absent means "presence was never resolved", which is not "offline". */
  it('shows no dot when presence is absent from the payload', () => {
    expect(mountRow(makeConversation()).find('[data-testid="online-dot"]').exists()).toBe(false)
  })

  it('never shows an online dot on a group row', () => {
    const wrapper = mountRow(
      makeConversation({
        type: 'activity',
        counterpart: null,
        activity: { id: 1, title: 'Yugurish' } as never,
        participants: [makeUser(2, 'Jasur')],
        participants_count: 2,
      }),
    )

    expect(wrapper.find('[data-testid="online-dot"]').exists()).toBe(false)
  })

  // -- handle ----------------------------------------------------------------

  it('shows the handle beside the display name', () => {
    expect(mountRow(makeConversation()).text()).toContain('@jasur')
  })

  /** Not twice. An account with no display name titles the row with the handle. */
  it('does not repeat the handle when it is already the title', () => {
    const person = { ...makeUser(2, 'Jasur'), display_name: '@jasur', name: '@jasur' }
    const text = mountRow(makeConversation({ counterpart: person as never })).text()

    expect(text.match(/@jasur/g)).toHaveLength(1)
  })

  it('copes with an account that has no handle yet', () => {
    const person = { ...makeUser(2, 'Jasur'), username: null }

    expect(() => mountRow(makeConversation({ counterpart: person as never }))).not.toThrow()
    expect(mountRow(makeConversation({ counterpart: person as never })).text()).not.toContain('@null')
  })

  // -- group rows ------------------------------------------------------------

  it('shows a face pile and the real member count for a group', () => {
    const wrapper = mountRow(
      makeConversation({
        type: 'activity',
        counterpart: null,
        activity: { id: 1, title: 'Yugurish' } as never,
        participants: [makeUser(2, 'A'), makeUser(3, 'B'), makeUser(4, 'C'), makeUser(5, 'D')],
        participants_count: 7,
      }),
    )

    // Three faces, and the overflow counts against the whole room rather than
    // against however many people the payload happened to carry.
    expect(wrapper.findAllComponents({ name: 'Avatar' }).length).toBe(3)
    expect(wrapper.text()).toContain('+4')
    expect(wrapper.text()).toContain('7')
  })

  it('falls back to the group icon when no participants were loaded', () => {
    const wrapper = mountRow(
      makeConversation({
        type: 'activity',
        counterpart: null,
        activity: { id: 1, title: 'Yugurish' } as never,
      }),
    )

    expect(wrapper.findAllComponents({ name: 'Avatar' }).length).toBe(0)
    expect(wrapper.text()).toContain('Yugurish')
  })
})
