import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatHeader from '@/components/chat/ChatHeader.vue'
import type { Conversation, User } from '@/types'

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

const FontAwesomeIcon = { props: ['icon'], template: '<i />' }

function makeUser(id: number, name: string, username: string | null = null): User {
  return {
    id,
    name,
    display_name: name,
    username,
    profile: { avatar_url: null },
  } as unknown as User
}

function mountHeader(conversation: Partial<Conversation>, extra: Record<string, unknown> = {}) {
  return mount(ChatHeader, {
    props: {
      conversation: {
        id: 1,
        type: 'direct',
        counterpart: makeUser(2, 'Jasur', 'jasur'),
        activity: null,
        participants: [],
        last_message_at: null,
        unread_count: 0,
        created_at: '2026-08-14T09:00:00.000Z',
        ...conversation,
      } as Conversation,
      ...extra,
    },
    global: { components: { FontAwesomeIcon }, stubs: { ReportBlockMenu: true, Avatar: true } },
  })
}

/**
 * A group room is not a 1:1 chat wearing a different hat.
 *
 * The header this replaces ran `otherPerson()` over every thread — the owner,
 * or else whichever participant was not you — so a five-person activity was
 * titled with one arbitrary member's name and face, and tapping it opened that
 * person's profile.
 */
describe('ChatHeader', () => {
  it('titles a direct thread with the other person', () => {
    expect(mountHeader({}).text()).toContain('Jasur')
  })

  it('titles a group thread with its activity, never a participant', () => {
    const wrapper = mountHeader({
      type: 'activity',
      counterpart: null,
      activity: { id: 9, title: 'Futbol', owner: makeUser(3, 'Aziz') } as Conversation['activity'],
      participants: [makeUser(3, 'Aziz'), makeUser(4, 'Bek'), makeUser(5, 'Dilshod')],
    })

    expect(wrapper.text()).toContain('Futbol')
    expect(wrapper.text()).toContain('3 ishtirokchi')
  })

  it('names the organiser of a group thread', () => {
    const wrapper = mountHeader({
      type: 'activity',
      counterpart: null,
      activity: { id: 9, title: 'Futbol', owner: makeUser(3, 'Aziz') } as Conversation['activity'],
      participants: [makeUser(3, 'Aziz'), makeUser(4, 'Bek')],
    })

    expect(wrapper.text()).toContain('Tashkilotchi: Aziz')
  })

  it('shows at most three faces and counts the rest', () => {
    const wrapper = mountHeader({
      type: 'activity',
      counterpart: null,
      activity: { id: 9, title: 'Futbol' } as Conversation['activity'],
      participants: [2, 3, 4, 5, 6].map((id) => makeUser(id, `User ${id}`)),
    })

    expect(wrapper.findAllComponents({ name: 'Avatar' }).length).toBe(3)
    expect(wrapper.text()).toContain('+2')
  })

  it('offers no profile link on a group thread', async () => {
    push.mockReset()

    const wrapper = mountHeader({
      type: 'activity',
      counterpart: null,
      activity: { id: 9, title: 'Futbol' } as Conversation['activity'],
      participants: [makeUser(3, 'Aziz')],
    })

    // The title area is a plain div for a group — there is no single person to
    // open, and opening an arbitrary one is the bug this replaced.
    expect(wrapper.find('[aria-label$="profili"]').exists()).toBe(false)
  })

  it('opens the counterpart’s profile from a direct thread', async () => {
    push.mockReset()

    const wrapper = mountHeader({})
    await wrapper.find('[aria-label="Jasur profili"]').trigger('click')

    expect(push).toHaveBeenCalledWith({
      name: 'user-profile-by-username',
      params: { username: 'jasur' },
    })
  })

  it('shows online only on a direct thread', () => {
    expect(mountHeader({}, { online: true }).text()).toContain('Onlayn')

    const group = mountHeader(
      {
        type: 'activity',
        counterpart: null,
        activity: { id: 9, title: 'Futbol' } as Conversation['activity'],
        participants: [makeUser(3, 'Aziz')],
      },
      { online: true },
    )

    expect(group.text()).not.toContain('Onlayn')
  })

  it('lets a typing indicator take over the subtitle', () => {
    const wrapper = mountHeader({}, { online: true, typingLabel: 'Jasur yozmoqda...' })

    expect(wrapper.text()).toContain('yozmoqda')
    expect(wrapper.text()).not.toContain('Onlayn')
  })
})
