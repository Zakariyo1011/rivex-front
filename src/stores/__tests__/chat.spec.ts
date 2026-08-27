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
  react: vi.fn(),
  unreact: vi.fn(),
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

  // -- the badge, while the user is somewhere else -------------------------

  /**
   * `receive()` only ever fires for the conversation that is open, because the
   * conversation channel is subscribed by ConversationView and left behind on
   * navigation. Everything below is the other wire: the message notification on
   * `App.Models.User.{id}`, which every screen holds open.
   */
  describe('noteMessageNotification', () => {
    it('raises the badge for a thread the user is not looking at', async () => {
      const chat = useChatStore()

      api.list.mockResolvedValue({
        data: { data: [makeConversation({ id: 7 })], meta: { total_unread: 0 } },
      })
      await chat.loadList()

      chat.noteMessageNotification(7)

      expect(chat.totalUnread).toBe(1)
      expect(chat.conversations.find((c) => c.id === 7)?.unread_count).toBe(1)
    })

    /**
     * The double-count guard. Both wires deliver the same message when a
     * conversation is open; `receive()` marks it read, so this must not also
     * count it. Getting this wrong shows a badge for a message on screen.
     */
    it('does not count a message in the conversation already open', async () => {
      const chat = await openConversation(makeConversation({ id: 3 }))

      chat.noteMessageNotification(3)

      expect(chat.totalUnread).toBe(0)
      expect(chat.conversations.find((c) => c.id === 3)?.unread_count).toBe(0)
    })

    it('refetches the list when the thread is not in it yet', async () => {
      const chat = useChatStore()

      api.list.mockResolvedValue({ data: { data: [], meta: { total_unread: 0 } } })
      await chat.loadList()
      api.list.mockClear()

      // Somebody writing to us for the first time: there is no row to increment.
      chat.noteMessageNotification(99)

      expect(api.list).toHaveBeenCalledTimes(1)
    })

    it('still moves the badge when the list has never been loaded', () => {
      const chat = useChatStore()

      chat.noteMessageNotification(99)

      expect(chat.totalUnread).toBe(1)
      expect(api.list).not.toHaveBeenCalled()
    })

    it('ignores a payload with no usable conversation id', () => {
      const chat = useChatStore()

      chat.noteMessageNotification(Number(undefined))

      expect(chat.totalUnread).toBe(0)
    })

    it('clears again when the conversation is opened', async () => {
      const chat = useChatStore()

      api.list.mockResolvedValue({
        data: { data: [makeConversation({ id: 7 })], meta: { total_unread: 0 } },
      })
      await chat.loadList()

      chat.noteMessageNotification(7)
      chat.noteMessageNotification(7)
      expect(chat.totalUnread).toBe(2)

      api.markRead.mockResolvedValue({ data: { total_unread: 0 } })
      await chat.markRead(7)

      expect(chat.totalUnread).toBe(0)
      expect(chat.conversations.find((c) => c.id === 7)?.unread_count).toBe(0)
    })
  })

  describe('loadUnreadBadge', () => {
    it('reads the count so the badge is right before chat is ever opened', async () => {
      const chat = useChatStore()

      api.list.mockResolvedValue({
        data: { data: [makeConversation({ id: 1, unread_count: 4 })], meta: { total_unread: 4 } },
      })

      await chat.loadUnreadBadge()

      expect(chat.totalUnread).toBe(4)
    })

    it('does not refetch when the list is already loaded', async () => {
      const chat = useChatStore()

      api.list.mockResolvedValue({ data: { data: [], meta: { total_unread: 0 } } })
      await chat.loadList()
      api.list.mockClear()

      await chat.loadUnreadBadge()

      expect(api.list).not.toHaveBeenCalled()
    })

    /** A wrong badge is worse than no badge. */
    it('leaves the badge alone when the request fails', async () => {
      const chat = useChatStore()

      api.list.mockRejectedValue(new Error('offline'))

      await chat.loadUnreadBadge()

      expect(chat.totalUnread).toBe(0)
    })
  })
})

/**
 * Replies and reactions.
 *
 * Kept in its own describe rather than folded into the block above because the
 * setup differs: these need the reaction endpoints mocked, and they care about
 * message *content* rather than about unread counts and echoes.
 */
describe('chat store — replies and reactions', () => {
  const api2 = api

  function user(id: number, name = 'Jasur'): User {
    return { id, name, display_name: name, profile: {} } as unknown as User
  }

  function message(overrides: Partial<Message> = {}): Message {
    return {
      id: 1,
      conversation_id: 1,
      body: 'salom',
      type: 'text',
      sender: user(2),
      reply_to: null,
      reactions: [],
      read_at: null,
      created_at: '2026-08-14T09:00:00.000Z',
      ...overrides,
    } as Message
  }

  function conversation(): Conversation {
    return {
      id: 1,
      type: 'direct',
      counterpart: user(2),
      activity: null,
      last_message: null,
      last_message_at: null,
      unread_count: 0,
      created_at: '2026-08-14T08:00:00.000Z',
    } as Conversation
  }

  async function open(messages: Message[] = []) {
    const chat = useChatStore()
    const c = conversation()

    api2.show.mockResolvedValue({ data: { data: c } })
    api2.messages.mockResolvedValue({
      data: { data: messages, meta: { has_more: false, next_cursor: null } },
    })

    chat.conversations = [c]
    await chat.open(c.id)

    return chat
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    useAuthStore().user = user(1, 'Zakariyo')

    Object.values(api2).forEach((fn) => fn.mockReset())
    api2.markRead.mockResolvedValue({ data: { total_unread: 0 } })
    api2.activities.mockResolvedValue({ data: { data: [] } })
  })

  // -- replies ---------------------------------------------------------------

  it('sends the reply target with the message', async () => {
    const original = message({ id: 5, body: 'Bugun soat 20:00 da boramizmi?' })
    const chat = await open([original])

    api2.sendMessage.mockResolvedValue({
      data: { data: message({ id: 6, body: 'Ha, boramiz.', sender: user(1) }) },
    })

    chat.startReply(original)
    await chat.send('Ha, boramiz.')

    expect(api2.sendMessage).toHaveBeenCalledWith(1, 'Ha, boramiz.', 5)
  })

  it('renders the reply as a reply before the server answers', async () => {
    const original = message({ id: 5, body: 'asl xabar' })
    const chat = await open([original])

    let resolve: (value: unknown) => void = () => {}
    api2.sendMessage.mockImplementation(() => new Promise((r) => (resolve = r)))

    chat.startReply(original)
    const inFlight = chat.send('javob')

    // The optimistic row already quotes the original, so the bubble does not
    // flicker from a loose message into a reply when the response lands.
    const optimistic = chat.messages.at(-1)!
    expect(optimistic.reply_to?.id).toBe(5)
    expect(optimistic.reply_to?.body).toBe('asl xabar')

    resolve({ data: { data: message({ id: 6, sender: user(1) }) } })
    await inFlight
  })

  it('clears the reply target as soon as the message is sent', async () => {
    const original = message({ id: 5 })
    const chat = await open([original])

    api2.sendMessage.mockResolvedValue({ data: { data: message({ id: 6, sender: user(1) }) } })

    chat.startReply(original)
    expect(chat.replyingTo?.id).toBe(5)

    await chat.send('javob')
    expect(chat.replyingTo).toBeNull()
  })

  it('refuses to reply to a message that has no server id yet', async () => {
    const chat = await open([])

    // An optimistic row carries a negative placeholder id; replying to it would
    // point at a message the server has never heard of.
    chat.startReply(message({ id: -1730000000 }))

    expect(chat.replyingTo).toBeNull()
  })

  it('drops the reply target when the conversation is closed', async () => {
    const original = message({ id: 5 })
    const chat = await open([original])

    chat.startReply(original)
    chat.close()

    // Otherwise the preview hangs over the next thread opened, quoting a
    // message from a conversation the composer is no longer in.
    expect(chat.replyingTo).toBeNull()
  })

  it('retrying a failed reply still sends it as a reply', async () => {
    const original = message({ id: 5 })
    const chat = await open([original])

    api2.sendMessage.mockRejectedValueOnce(new Error('network'))

    chat.startReply(original)
    await chat.send('javob')

    const failed = chat.messages.find((m) => m.failed)!
    expect(failed.reply_to?.id).toBe(5)

    api2.sendMessage.mockResolvedValue({ data: { data: message({ id: 7, sender: user(1) }) } })
    await chat.retry(failed)

    expect(api2.sendMessage).toHaveBeenLastCalledWith(1, 'javob', 5)
  })

  // -- reactions -------------------------------------------------------------

  it('adds a reaction optimistically and keeps the servers answer', async () => {
    const target = message({ id: 5 })
    const chat = await open([target])

    let resolve: (value: unknown) => void = () => {}
    api2.react.mockImplementation(() => new Promise((r) => (resolve = r)))

    const inFlight = chat.toggleReaction(chat.messages[0], '👍')

    expect(chat.messages[0].reactions).toEqual([{ emoji: '👍', count: 1, user_ids: [1] }])
    expect(chat.myReaction(chat.messages[0])).toBe('👍')

    resolve({
      data: { data: { message_id: 5, reactions: [{ emoji: '👍', count: 1, user_ids: [1] }] } },
    })
    await inFlight

    expect(api2.react).toHaveBeenCalledWith(1, 5, '👍')
  })

  it('tapping the emoji already held removes it', async () => {
    const target = message({ id: 5, reactions: [{ emoji: '👍', count: 1, user_ids: [1] }] })
    const chat = await open([target])

    api2.unreact.mockResolvedValue({ data: { data: { message_id: 5, reactions: [] } } })

    await chat.toggleReaction(chat.messages[0], '👍')

    expect(api2.unreact).toHaveBeenCalledWith(1, 5)
    expect(chat.messages[0].reactions).toEqual([])
  })

  /**
   * 🔴 One reaction per person.
   *
   * Choosing a second emoji must MOVE the person, not add them again — the
   * database enforces this with a unique key and the client has to agree, or
   * the badge row claims one person holds two opinions.
   */
  it('changing a reaction moves the person rather than adding them twice', async () => {
    const target = message({ id: 5, reactions: [{ emoji: '👍', count: 1, user_ids: [1] }] })
    const chat = await open([target])

    api2.react.mockResolvedValue({
      data: { data: { message_id: 5, reactions: [{ emoji: '❤️', count: 1, user_ids: [1] }] } },
    })

    await chat.toggleReaction(chat.messages[0], '❤️')

    expect(chat.messages[0].reactions).toEqual([{ emoji: '❤️', count: 1, user_ids: [1] }])
    expect(chat.myReaction(chat.messages[0])).toBe('❤️')
  })

  it('rolls the reaction back when the write fails', async () => {
    const before = [{ emoji: '👍', count: 2, user_ids: [1, 3] }]
    const target = message({ id: 5, reactions: before })
    const chat = await open([target])

    api2.unreact.mockRejectedValue(new Error('network'))

    await chat.toggleReaction(chat.messages[0], '👍')

    expect(chat.messages[0].reactions).toEqual(before)
  })

  it('refuses to react to a message with no server id', async () => {
    const chat = await open([])
    chat.messages.push(message({ id: -1, sender: user(1) }))

    await chat.toggleReaction(chat.messages[0], '👍')

    expect(api2.react).not.toHaveBeenCalled()
  })

  // -- realtime deltas -------------------------------------------------------

  it('applies another persons reaction from the wire', async () => {
    const chat = await open([message({ id: 5 })])

    chat.receiveReaction({ message_id: 5, user_id: 9, emoji: '😂', previous_emoji: null })

    expect(chat.messages[0].reactions).toEqual([{ emoji: '😂', count: 1, user_ids: [9] }])
    // Somebody else's reaction is not mine.
    expect(chat.myReaction(chat.messages[0])).toBeNull()
  })

  it('aggregates reactions from several people', async () => {
    const chat = await open([message({ id: 5 })])

    chat.receiveReaction({ message_id: 5, user_id: 9, emoji: '👍', previous_emoji: null })
    chat.receiveReaction({ message_id: 5, user_id: 10, emoji: '👍', previous_emoji: null })
    chat.receiveReaction({ message_id: 5, user_id: 11, emoji: '❤️', previous_emoji: null })

    const groups = chat.messages[0].reactions!
    expect(groups.find((g) => g.emoji === '👍')!.count).toBe(2)
    expect(groups.find((g) => g.emoji === '❤️')!.count).toBe(1)
  })

  /**
   * 🔴 Without `previous_emoji`, a change reads as an addition and the badge
   * the person is leaving never comes down.
   */
  it('decrements the badge a remote user is leaving', async () => {
    const chat = await open([message({ id: 5 })])

    chat.receiveReaction({ message_id: 5, user_id: 9, emoji: '👍', previous_emoji: null })
    chat.receiveReaction({ message_id: 5, user_id: 9, emoji: '❤️', previous_emoji: '👍' })

    expect(chat.messages[0].reactions).toEqual([{ emoji: '❤️', count: 1, user_ids: [9] }])
  })

  it('removes the group entirely when its last reactor leaves', async () => {
    const chat = await open([message({ id: 5 })])

    chat.receiveReaction({ message_id: 5, user_id: 9, emoji: '👍', previous_emoji: null })
    chat.receiveReaction({ message_id: 5, user_id: 9, emoji: null, previous_emoji: '👍' })

    expect(chat.messages[0].reactions).toEqual([])
  })

  /**
   * Reverb can deliver the same frame twice across a reconnect. Applying it
   * twice must not count the person twice.
   */
  it('is idempotent when the same frame arrives twice', async () => {
    const chat = await open([message({ id: 5 })])

    const frame = { message_id: 5, user_id: 9, emoji: '👍', previous_emoji: null }
    chat.receiveReaction(frame)
    chat.receiveReaction(frame)

    expect(chat.messages[0].reactions).toEqual([{ emoji: '👍', count: 1, user_ids: [9] }])
  })

  it('ignores a reaction for a message that is not loaded', async () => {
    const chat = await open([message({ id: 5 })])

    chat.receiveReaction({ message_id: 999, user_id: 9, emoji: '👍', previous_emoji: null })

    expect(chat.messages[0].reactions).toEqual([])
  })
})

/**
 * Why a send failed, not just that it did.
 *
 * 🔴 The regression these pin: a message that was actually saved reported
 * "Yuborilmadi" because the websocket server was unreachable and the broadcast
 * threw inside the request. The backend no longer fails the write for that
 * reason — see BroadcastResilienceTest — and on the client every failure now
 * carries a reason derived from the response status rather than one
 * unexplained string for all of them.
 */
describe('chat store — send failures', () => {
  const api3 = api

  function user(id: number, name = 'Jasur'): User {
    return { id, name, display_name: name, profile: {} } as unknown as User
  }

  function conversation(): Conversation {
    return {
      id: 1,
      type: 'direct',
      counterpart: user(2),
      activity: null,
      last_message: null,
      last_message_at: null,
      unread_count: 0,
      created_at: '2026-08-14T08:00:00.000Z',
    } as Conversation
  }

  async function open() {
    const chat = useChatStore()
    const c = conversation()

    api3.show.mockResolvedValue({ data: { data: c } })
    api3.messages.mockResolvedValue({
      data: { data: [], meta: { has_more: false, next_cursor: null } },
    })

    chat.conversations = [c]
    await chat.open(c.id)

    return chat
  }

  /** Shaped like an axios error, which is what the describer branches on. */
  function httpError(status: number, body: Record<string, unknown> = {}) {
    return {
      isAxiosError: true,
      response: { status, data: body },
      message: `Request failed with status code ${status}`,
      toJSON: () => ({}),
      name: 'AxiosError',
    }
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    useAuthStore().user = user(1, 'Zakariyo')

    Object.values(api3).forEach((fn) => fn.mockReset())
    api3.markRead.mockResolvedValue({ data: { total_unread: 0 } })
    api3.activities.mockResolvedValue({ data: { data: [] } })

    // The describer logs the real error; keep the test output readable.
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('marks the message failed and keeps it in the thread', async () => {
    const chat = await open()
    api3.sendMessage.mockRejectedValue(httpError(500))

    expect(await chat.send('salom')).toBe(false)

    const failed = chat.messages.at(-1)!
    expect(failed.failed).toBe(true)
    expect(failed.pending).toBe(false)
  })

  /** A 500 must never surface the server's own words — see describeApiError. */
  it('does not leak a server error message to the sender', async () => {
    const chat = await open()
    api3.sendMessage.mockRejectedValue(
      httpError(500, { message: 'Pusher error: cURL error 7: Connection refused' }),
    )

    await chat.send('salom')

    const reason = chat.messages.at(-1)!.failed_reason ?? ''
    expect(reason).not.toContain('Pusher')
    expect(reason).not.toContain('cURL')
    expect(reason).toContain('Serverda xatolik')
  })

  /** A 422 is written for the user, so it is shown verbatim. */
  it('shows the servers validation message', async () => {
    const chat = await open()
    api3.sendMessage.mockRejectedValue(
      httpError(422, { errors: { conversation: ['Xabar yubora olmaysiz.'] } }),
    )

    await chat.send('salom')

    expect(chat.messages.at(-1)!.failed_reason).toBe('Xabar yubora olmaysiz.')
  })

  it('names a rate limit rather than calling it a server error', async () => {
    const chat = await open()
    api3.sendMessage.mockRejectedValue(httpError(429))

    await chat.send('salom')

    expect(chat.messages.at(-1)!.failed_reason).toContain("Juda ko'p urinish")
  })

  it('names a permission failure', async () => {
    const chat = await open()
    api3.sendMessage.mockRejectedValue(httpError(403))

    await chat.send('salom')

    expect(chat.messages.at(-1)!.failed_reason).toContain('ruxsatingiz')
  })

  /** No response at all: the request never reached the server. */
  it('names a connection failure when there is no response', async () => {
    const chat = await open()
    api3.sendMessage.mockRejectedValue({
      isAxiosError: true,
      response: undefined,
      message: 'Network Error',
      toJSON: () => ({}),
      name: 'AxiosError',
    })

    await chat.send('salom')

    expect(chat.messages.at(-1)!.failed_reason).toContain('ulanib')
  })

  /**
   * A failed reply must stay a reply.
   *
   * The reply target is cleared optimistically when the send starts, so without
   * restoring it the retry would silently send a loose message instead.
   */
  it('restores the reply target when a reply fails', async () => {
    const chat = await open()
    const parent = {
      id: 5,
      conversation_id: 1,
      body: 'asl',
      type: 'text',
      sender: user(2),
      created_at: '2026-08-14T09:00:00.000Z',
    } as Message

    chat.messages.push(parent)
    chat.startReply(parent)

    api3.sendMessage.mockRejectedValue(httpError(500))
    await chat.send('javob')

    expect(chat.replyingTo?.id).toBe(5)
  })

  /** A failed message must be dismissable, not stuck in the thread. */
  it('discards a failed message on request', async () => {
    const chat = await open()
    api3.sendMessage.mockRejectedValue(httpError(500))

    await chat.send('salom')
    const failed = chat.messages.at(-1)!

    chat.discardFailed(failed)

    expect(chat.messages).toHaveLength(0)
  })
})
