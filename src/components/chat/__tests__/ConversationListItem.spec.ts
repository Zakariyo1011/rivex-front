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
})
