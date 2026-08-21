import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const list = vi.fn()
const markRead = vi.fn()
const markAllRead = vi.fn()

vi.mock('@/api/notifications', () => ({
  notificationsApi: {
    list: (...args: unknown[]) => list(...args),
    markRead: (...args: unknown[]) => markRead(...args),
    markAllRead: () => markAllRead(),
  },
}))

vi.mock('@/composables/useEchoChannel', () => ({ useEchoChannel: vi.fn() }))

const conversationsList = vi.fn()
vi.mock('@/api/conversations', () => ({
  conversationsApi: { list: (...args: unknown[]) => conversationsList(...args) },
}))
vi.mock('@/composables/useEcho', () => ({ onEchoReconnect: vi.fn(() => () => {}) }))

const toastInfo = vi.fn()
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ info: toastInfo, success: vi.fn(), error: vi.fn() }),
}))

const { useNotificationsStore } = await import('@/stores/notifications')
const { useChatStore } = await import('@/stores/chat')

function page(items: { id: string; read?: boolean }[], meta: Partial<Record<string, number>> = {}) {
  return {
    data: {
      data: items.map((item) => ({
        id: item.id,
        type: 'new_application',
        title: 'T',
        body: 'B',
        data: {},
        read: item.read ?? false,
        created_at: new Date().toISOString(),
      })),
      meta: {
        current_page: meta.current_page ?? 1,
        last_page: meta.last_page ?? 1,
        unread_count: meta.unread_count ?? items.filter((i) => !i.read).length,
      },
    },
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('notifications store', () => {
  it('loads a page and reports the unread badge from the server', async () => {
    list.mockResolvedValue(page([{ id: 'a' }, { id: 'b', read: true }]))

    const store = useNotificationsStore()
    await store.fetch()

    expect(store.notifications).toHaveLength(2)
    expect(store.unreadCount).toBe(1)
    expect(store.loaded).toBe(true)
  })

  it('appends the next page rather than replacing it', async () => {
    list.mockResolvedValueOnce(page([{ id: 'a' }], { current_page: 1, last_page: 2 }))

    const store = useNotificationsStore()
    await store.fetch()
    expect(store.hasMore).toBe(true)

    list.mockResolvedValueOnce(page([{ id: 'b' }], { current_page: 2, last_page: 2 }))
    await store.loadMore()

    expect(store.notifications.map((n) => n.id)).toEqual(['a', 'b'])
    expect(store.hasMore).toBe(false)
  })

  it('does not fetch beyond the last page', async () => {
    list.mockResolvedValue(page([{ id: 'a' }], { current_page: 1, last_page: 1 }))

    const store = useNotificationsStore()
    await store.fetch()
    await store.loadMore()

    expect(list).toHaveBeenCalledTimes(1)
  })

  it('drops the badge immediately when a row is read', async () => {
    list.mockResolvedValue(page([{ id: 'a' }]))
    markRead.mockResolvedValue({ data: { unread_count: 0 } })

    const store = useNotificationsStore()
    await store.fetch()
    await store.markRead('a')

    expect(store.notifications[0]!.read).toBe(true)
    expect(store.unreadCount).toBe(0)
  })

  it('puts the badge back if marking read fails', async () => {
    list.mockResolvedValue(page([{ id: 'a' }]))
    markRead.mockRejectedValue(new Error('offline'))

    const store = useNotificationsStore()
    await store.fetch()
    await store.markRead('a')

    expect(store.notifications[0]!.read).toBe(false)
    expect(store.unreadCount).toBe(1)
  })

  it('clears everything on mark all read', async () => {
    list.mockResolvedValue(page([{ id: 'a' }, { id: 'b' }]))
    markAllRead.mockResolvedValue({ data: { unread_count: 0 } })

    const store = useNotificationsStore()
    await store.fetch()
    await store.markAllRead()

    expect(store.unreadCount).toBe(0)
    expect(store.notifications.every((n) => n.read)).toBe(true)
  })

  describe('live arrivals', () => {
    it('prepends a new notification, bumps the badge and toasts', async () => {
      list.mockResolvedValue(page([{ id: 'a' }]))

      const store = useNotificationsStore()
      await store.fetch()

      store.handleIncoming({ id: 'live', type: 'payment_refunded', title: 'Qaytarildi', body: 'X' })

      expect(store.notifications[0]!.id).toBe('live')
      expect(store.unreadCount).toBe(2)
      expect(toastInfo).toHaveBeenCalledWith('Qaytarildi')
    })

    /** Reverb can redeliver a frame across a reconnect. */
    it('ignores a duplicate id', async () => {
      list.mockResolvedValue(page([{ id: 'a' }]))

      const store = useNotificationsStore()
      await store.fetch()

      store.handleIncoming({ id: 'live', type: 'x', title: 'T', body: 'B' })
      store.handleIncoming({ id: 'live', type: 'x', title: 'T', body: 'B' })

      expect(store.notifications.filter((n) => n.id === 'live')).toHaveLength(1)
      expect(store.unreadCount).toBe(2)
    })

    it('does not re-add a row that a refetch already delivered', async () => {
      list.mockResolvedValue(page([{ id: 'race' }]))

      const store = useNotificationsStore()
      await store.fetch()

      store.handleIncoming({ id: 'race', type: 'x', title: 'T', body: 'B' })

      expect(store.notifications).toHaveLength(1)
    })
  })


  /**
   * The chat badge rides on the message notification.
   *
   * `App.Models.User.{id}` is the only channel a client holds open from every
   * screen, so it is the only wire that can tell the chat count about a message
   * arriving while the user is elsewhere. These pin the handoff — and, more
   * importantly, that it happens exactly once.
   */
  describe('the chat badge handoff', () => {
    it('raises the chat count when a message notification arrives', async () => {
      list.mockResolvedValue(page([]))
      conversationsList.mockResolvedValue({ data: { data: [], meta: { total_unread: 0 } } })

      const store = useNotificationsStore()
      const chat = useChatStore()
      await store.fetch()

      store.handleIncoming({
        id: 'm1',
        type: 'new_message',
        title: 'Jasur',
        body: 'salom',
        conversation_id: 4,
      })

      expect(chat.totalUnread).toBe(1)
    })

    /**
     * The conversation on screen is delivered by both wires. Exactly one of
     * them may count it, and the open thread is read as it arrives — so
     * neither the bell nor the chat badge moves.
     */
    it('counts nothing for the conversation already open', async () => {
      list.mockResolvedValue(page([]))
      conversationsList.mockResolvedValue({ data: { data: [], meta: { total_unread: 0 } } })

      const store = useNotificationsStore()
      const chat = useChatStore()
      await store.fetch()

      store.setActiveConversation(4)

      store.handleIncoming({
        id: 'm1',
        type: 'new_message',
        title: 'Jasur',
        body: 'salom',
        conversation_id: 4,
      })

      expect(chat.totalUnread).toBe(0)
      expect(store.unreadCount).toBe(0)
    })

    it('leaves the chat count alone for notifications that are not messages', async () => {
      list.mockResolvedValue(page([]))

      const store = useNotificationsStore()
      const chat = useChatStore()
      await store.fetch()

      store.handleIncoming({ id: 'f1', type: 'new_follower', title: 'X', body: 'Y' })

      expect(chat.totalUnread).toBe(0)
      expect(conversationsList).not.toHaveBeenCalled()
    })

    /** A redelivered frame must not count twice on either badge. */
    it('does not count a redelivered frame twice', async () => {
      list.mockResolvedValue(page([]))
      conversationsList.mockResolvedValue({ data: { data: [], meta: { total_unread: 0 } } })

      const store = useNotificationsStore()
      const chat = useChatStore()
      await store.fetch()

      const frame = {
        id: 'm1',
        type: 'new_message',
        title: 'Jasur',
        body: 'salom',
        conversation_id: 4,
      }

      store.handleIncoming(frame)
      store.handleIncoming(frame)

      expect(chat.totalUnread).toBe(1)
      expect(store.unreadCount).toBe(1)
    })
  })

  it('forgets everything on reset so the next user starts clean', async () => {
    list.mockResolvedValue(page([{ id: 'a' }]))

    const store = useNotificationsStore()
    await store.fetch()
    store.reset()

    expect(store.notifications).toEqual([])
    expect(store.unreadCount).toBe(0)
    expect(store.loaded).toBe(false)
  })
})
