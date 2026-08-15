import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useChatStore } from '@/stores/chat'
import { useAuthStore } from '@/stores/auth'
import type { Conversation, Message, User } from '@/types'

// `vi.mock` is hoisted above every top-level binding, so the mock object has to
// be created inside `vi.hoisted` rather than declared as a const above it.
const api = vi.hoisted(() => ({
  list: vi.fn(),
  show: vi.fn(),
  messages: vi.fn(),
  sendMessage: vi.fn(),
  markRead: vi.fn(),
  activities: vi.fn(),
  openWith: vi.fn(),
  forActivity: vi.fn(),
}))

vi.mock('@/api/conversations', () => ({ conversationsApi: api }))

function makeUser(id: number, name = 'Jasur'): User {
  return { id, name, display_name: name, profile: {} } as unknown as User
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 1,
    conversation_id: 1,
    body: 'salom',
    type: 'text',
    sender: makeUser(2),
    read_at: null,
    created_at: '2026-08-14T09:00:00.000Z',
    ...overrides,
  } as Message
}

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 1,
    type: 'direct',
    counterpart: makeUser(2),
    activity: null,
    last_message: null,
    last_message_at: null,
    unread_count: 0,
    created_at: '2026-08-14T08:00:00.000Z',
    ...overrides,
  } as Conversation
}

describe('chat store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useAuthStore().user = makeUser(1, 'Zakariyo')

    Object.values(api).forEach((fn) => fn.mockReset())
    api.markRead.mockResolvedValue({ data: { total_unread: 0 } })
    api.activities.mockResolvedValue({ data: { data: [] } })
  })

  async function openConversation(conversation = makeConversation(), messages: Message[] = []) {
    const chat = useChatStore()

    api.show.mockResolvedValue({ data: { data: conversation } })
    api.messages.mockResolvedValue({ data: { data: messages, meta: { has_more: false, next_cursor: null } } })

    chat.conversations = [conversation]
    await chat.open(conversation.id)

    return chat
  }

  // -- the echo of your own message ---------------------------------------

  /**
   * A sender is subscribed to the same channel they publish on, so the
   * broadcast of their own message comes back to them. Without a guard it
   * renders twice: once optimistically, once from the wire.
   */
  it('does not render a message twice when its own broadcast returns', async () => {
    const chat = await openConversation()

    api.sendMessage.mockResolvedValue({ data: { data: makeMessage({ id: 10, sender: makeUser(1) }) } })

    await chat.send('salom')
    chat.receive(makeMessage({ id: 10, sender: makeUser(1) }))

    expect(chat.messages.filter((m) => m.id === 10)).toHaveLength(1)
  })

  it('ignores a duplicate broadcast of the same message', async () => {
    const chat = await openConversation()

    chat.receive(makeMessage({ id: 5 }))
    chat.receive(makeMessage({ id: 5 }))

    expect(chat.messages).toHaveLength(1)
  })

  // -- optimistic send -----------------------------------------------------

  it('shows a message immediately and replaces it with the server’s row', async () => {
    const chat = await openConversation()

    let resolve!: (value: unknown) => void
    api.sendMessage.mockReturnValue(new Promise((r) => (resolve = r)))

    const sending = chat.send('salom')

    expect(chat.messages).toHaveLength(1)
    expect(chat.messages[0].pending).toBe(true)

    resolve({ data: { data: makeMessage({ id: 99, sender: makeUser(1) }) } })
    await sending

    expect(chat.messages).toHaveLength(1)
    expect(chat.messages[0].id).toBe(99)
    expect(chat.messages[0].pending).toBeFalsy()
  })

  it('marks a message failed rather than dropping it', async () => {
    const chat = await openConversation()
    api.sendMessage.mockRejectedValue(new Error('offline'))

    const ok = await chat.send('salom')

    expect(ok).toBe(false)
    expect(chat.messages).toHaveLength(1)
    expect(chat.messages[0].failed).toBe(true)
    expect(chat.messages[0].body).toBe('salom')
  })

  it('replaces the failed row on retry instead of leaving both', async () => {
    const chat = await openConversation()
    api.sendMessage.mockRejectedValue(new Error('offline'))
    await chat.send('salom')

    api.sendMessage.mockResolvedValue({ data: { data: makeMessage({ id: 7, sender: makeUser(1) }) } })
    await chat.retry(chat.messages[0])

    expect(chat.messages).toHaveLength(1)
    expect(chat.messages[0].id).toBe(7)
  })

  // -- unread --------------------------------------------------------------

  it('raises unread for a conversation that is not open', () => {
    const chat = useChatStore()
    chat.conversations = [makeConversation({ id: 2, unread_count: 0 })]

    chat.receive(makeMessage({ id: 3, conversation_id: 2 }))

    expect(chat.conversations[0].unread_count).toBe(1)
    expect(chat.totalUnread).toBe(1)
  })

  it('does not raise unread for the conversation being read', async () => {
    const chat = await openConversation(makeConversation({ id: 1 }))

    chat.receive(makeMessage({ id: 3, conversation_id: 1 }))

    expect(chat.conversations[0].unread_count).toBe(0)
  })

  it('never counts your own message as unread', () => {
    const chat = useChatStore()
    chat.conversations = [makeConversation({ id: 2 })]

    chat.receive(makeMessage({ id: 3, conversation_id: 2, sender: makeUser(1) }))

    expect(chat.conversations[0].unread_count).toBe(0)
    expect(chat.totalUnread).toBe(0)
  })

  it('clears the badge as the thread opens, before the server answers', async () => {
    const chat = useChatStore()
    chat.conversations = [makeConversation({ id: 2, unread_count: 4 })]
    chat.totalUnread = 4

    let resolve!: (value: unknown) => void
    api.markRead.mockReturnValue(new Promise((r) => (resolve = r)))

    const marking = chat.markRead(2)

    expect(chat.conversations[0].unread_count).toBe(0)
    expect(chat.totalUnread).toBe(0)

    resolve({ data: { total_unread: 0 } })
    await marking
  })

  it('restores the badge when marking read fails', async () => {
    const chat = useChatStore()
    chat.conversations = [makeConversation({ id: 2, unread_count: 4 })]
    api.markRead.mockRejectedValue(new Error('offline'))

    await chat.markRead(2)

    expect(chat.conversations[0].unread_count).toBe(4)
  })

  // -- ordering ------------------------------------------------------------

  it('orders conversations by their newest message', () => {
    const chat = useChatStore()
    chat.conversations = [
      makeConversation({ id: 1, last_message_at: '2026-08-14T09:00:00.000Z' }),
      makeConversation({ id: 2, last_message_at: '2026-08-14T11:00:00.000Z' }),
      makeConversation({ id: 3, last_message_at: null, created_at: '2026-08-14T10:00:00.000Z' }),
    ]

    expect(chat.ordered.map((c) => c.id)).toEqual([2, 3, 1])
  })

  it('moves a conversation up when a message arrives in it', () => {
    const chat = useChatStore()
    chat.conversations = [
      makeConversation({ id: 1, last_message_at: '2026-08-14T09:00:00.000Z' }),
      makeConversation({ id: 2, last_message_at: '2026-08-14T08:00:00.000Z' }),
    ]

    chat.receive(makeMessage({ id: 9, conversation_id: 2, created_at: '2026-08-14T12:00:00.000Z' }))

    expect(chat.ordered[0].id).toBe(2)
  })

  /** A first message from someone new has no row to update. */
  it('refetches the list when a message arrives for an unknown conversation', () => {
    const chat = useChatStore()
    chat.conversations = []
    api.list.mockResolvedValue({ data: { data: [], meta: { total_unread: 0 } } })

    chat.receive(makeMessage({ id: 9, conversation_id: 77 }))

    expect(api.list).toHaveBeenCalled()
  })

  // -- read receipts -------------------------------------------------------

  it('applies a receipt to every own message up to the high-water mark', async () => {
    const chat = await openConversation(makeConversation(), [
      makeMessage({ id: 1, sender: makeUser(1) }),
      makeMessage({ id: 2, sender: makeUser(1) }),
      makeMessage({ id: 3, sender: makeUser(1) }),
    ])

    chat.applyReadReceipt({
      user_id: 2,
      read_at: '2026-08-14T09:10:00.000Z',
      last_read_message_id: 2,
    })

    expect(chat.messages[0].read_at).toBeTruthy()
    expect(chat.messages[1].read_at).toBeTruthy()
    expect(chat.messages[2].read_at).toBeNull()
  })

  it('ignores its own read event', async () => {
    const chat = await openConversation(makeConversation(), [
      makeMessage({ id: 1, sender: makeUser(1) }),
    ])

    chat.applyReadReceipt({
      user_id: 1,
      read_at: '2026-08-14T09:10:00.000Z',
      last_read_message_id: 1,
    })

    expect(chat.messages[0].read_at).toBeNull()
  })
})
