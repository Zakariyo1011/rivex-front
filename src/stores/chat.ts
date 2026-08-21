import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { conversationsApi } from '@/api/conversations'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import type { Activity, Conversation, Message } from '@/types'

/**
 * Chat state, shared by the list and the open conversation.
 *
 * Previously there was no store at all: `ChatsView` and `ChatDetailView` each
 * fetched their own copy, which is why the list could not show a last message
 * or an unread badge — it had no idea what was happening in the thread the user
 * was reading. One place owns it now, so opening a conversation clears its
 * badge in the list behind it, and an incoming message moves the row to the top
 * without a refetch.
 */
export const useChatStore = defineStore('chat', () => {
  const auth = useAuthStore()
  const notifications = useNotificationsStore()

  const conversations = ref<Conversation[]>([])
  const listLoaded = ref(false)
  const listLoading = ref(false)
  const listError = ref(false)

  const active = ref<Conversation | null>(null)
  const messages = ref<Message[]>([])
  const activities = ref<Activity[]>([])
  const loading = ref(false)
  const hasError = ref(false)

  /** Cursor for older messages. Null once the top of the thread is reached. */
  const olderCursor = ref<string | null>(null)
  const loadingOlder = ref(false)

  const totalUnread = ref(0)

  const hasOlder = computed(() => olderCursor.value !== null)

  /** Newest first — the only ordering a chat list can have. */
  const ordered = computed(() =>
    [...conversations.value].sort((a, b) => {
      const left = a.last_message_at ?? a.created_at
      const right = b.last_message_at ?? b.created_at

      return right.localeCompare(left)
    }),
  )

  // -- list -----------------------------------------------------------------

  async function loadList() {
    listLoading.value = true
    listError.value = false

    try {
      const { data } = await conversationsApi.list()
      conversations.value = data.data
      totalUnread.value = data.meta?.total_unread ?? 0
      listLoaded.value = true
    } catch {
      listError.value = true
    } finally {
      listLoading.value = false
    }
  }

  // -- one conversation -----------------------------------------------------

  async function open(id: number) {
    loading.value = true
    hasError.value = false
    messages.value = []
    activities.value = []
    olderCursor.value = null

    try {
      const [conversationRes, messagesRes] = await Promise.all([
        conversationsApi.show(id),
        conversationsApi.messages(id),
      ])

      active.value = conversationRes.data.data

      // Silence the bell for this thread while it is being read.
      notifications.setActiveConversation(id)
      messages.value = messagesRes.data.data
      olderCursor.value = messagesRes.data.meta?.has_more
        ? (messagesRes.data.meta.next_cursor ?? null)
        : null

      // Context, and only for a direct thread — a group room is already named
      // by its own activity.
      if (active.value.type === 'direct') {
        void loadActivities(id)
      }

      void markRead(id)
    } catch {
      hasError.value = true
    } finally {
      loading.value = false
    }
  }

  async function loadActivities(id: number) {
    try {
      const { data } = await conversationsApi.activities(id)
      activities.value = data.data
    } catch {
      activities.value = []
    }
  }

  /**
   * Older messages, prepended.
   *
   * Cursor-based, so a message arriving while the user reads history does not
   * shift the page under them — the failure an offset paginator guarantees on a
   * list that is being appended to.
   */
  async function loadOlder() {
    if (!active.value || olderCursor.value === null || loadingOlder.value) return

    loadingOlder.value = true

    try {
      const { data } = await conversationsApi.messages(active.value.id, olderCursor.value)
      const known = new Set(messages.value.map((m) => m.id))

      messages.value = [...data.data.filter((m) => !known.has(m.id)), ...messages.value]
      olderCursor.value = data.meta?.has_more ? (data.meta.next_cursor ?? null) : null
    } catch {
      // Leaving the cursor in place means the next scroll retries rather than
      // silently deciding the conversation has no history.
    } finally {
      loadingOlder.value = false
    }
  }

  function close() {
    notifications.setActiveConversation(null)
    active.value = null
    messages.value = []
    activities.value = []
    olderCursor.value = null
  }

  // -- sending --------------------------------------------------------------

  async function send(body: string): Promise<boolean> {
    const conversation = active.value
    if (!conversation || !auth.user || !body.trim()) return false

    const tempId = -Date.now()

    const optimistic: Message = {
      id: tempId,
      conversation_id: conversation.id,
      body,
      type: 'text',
      sender: auth.user,
      read_at: null,
      created_at: new Date().toISOString(),
      pending: true,
    }

    messages.value.push(optimistic)

    try {
      const { data } = await conversationsApi.sendMessage(conversation.id, body)

      const index = messages.value.findIndex((m) => m.id === tempId)
      if (index !== -1) messages.value.splice(index, 1)

      // The broadcast of our own message may have arrived first.
      if (!messages.value.some((m) => m.id === data.data.id)) {
        messages.value.push(data.data)
      }

      touch(conversation.id, data.data)

      return true
    } catch {
      const failed = messages.value.find((m) => m.id === tempId)
      if (failed) {
        failed.pending = false
        failed.failed = true
      }

      return false
    }
  }

  /** Re-send a message whose first attempt failed, in place. */
  async function retry(message: Message): Promise<boolean> {
    const index = messages.value.findIndex((m) => m.id === message.id)
    if (index !== -1) messages.value.splice(index, 1)

    return send(message.body)
  }

  // -- realtime -------------------------------------------------------------

  /**
   * A message arrived on the wire.
   *
   * Also called for our own messages, since the sender is subscribed to the
   * same channel — hence the id check. Without it a sent message renders twice:
   * once optimistically and once from the echo.
   */
  function receive(message: Message) {
    if (active.value?.id === message.conversation_id) {
      if (messages.value.some((m) => m.id === message.id)) return
      messages.value.push(message)
    }

    touch(message.conversation_id, message)

    const isMine = message.sender.id === auth.user?.id
    const isOpen = active.value?.id === message.conversation_id

    if (isMine) return

    if (isOpen) {
      void markRead(message.conversation_id)
    } else {
      bumpUnread(message.conversation_id)
    }
  }

  /**
   * The other side has caught up to `lastReadMessageId`.
   *
   * Everything of ours up to that id gets a receipt — including messages the
   * client had not loaded when the event arrived, which is why the event
   * carries a high-water mark rather than a list of ids.
   */
  function applyReadReceipt(payload: { user_id: number; read_at: string; last_read_message_id: number }) {
    if (payload.user_id === auth.user?.id) return

    messages.value.forEach((message) => {
      if (message.sender.id !== auth.user?.id) return
      if (message.read_at) return
      if (payload.last_read_message_id && message.id > payload.last_read_message_id) return

      message.read_at = payload.read_at
    })
  }

  // -- unread ---------------------------------------------------------------

  async function markRead(id: number) {
    const conversation = conversations.value.find((c) => c.id === id)
    const had = conversation?.unread_count ?? 0

    // Optimistic: the badge should clear as the thread opens, not a round trip
    // later.
    if (conversation) conversation.unread_count = 0
    totalUnread.value = Math.max(0, totalUnread.value - had)

    notifications.dismissForConversation(id)

    try {
      const { data } = await conversationsApi.markRead(id)
      totalUnread.value = data.total_unread ?? totalUnread.value
    } catch {
      if (conversation) conversation.unread_count = had
    }
  }

  function bumpUnread(id: number) {
    const conversation = conversations.value.find((c) => c.id === id)
    if (conversation) conversation.unread_count += 1
    totalUnread.value += 1
  }

  /**
   * The chat badge, kept true while the user is anywhere else in the app.
   *
   * ## The problem this solves
   *
   * `receive()` above only ever runs for the conversation that is *open*: the
   * `conversation.{id}` channel is subscribed by ConversationView and left
   * behind on navigation, which is correct — the alternative is a subscription
   * per conversation. So while the user is on Home, or an activity, or their
   * profile, nothing on the client heard about a new message at all, and the
   * badge showed whatever `loadList()` last saw. The count on the tab pointing
   * at chat was stale until you visited chat, which is the one screen that
   * makes the badge unnecessary.
   *
   * The message notification, on the other hand, arrives on
   * `App.Models.User.{id}` — a channel every signed-in client already holds
   * open. That is the wire this reads.
   *
   * ## Why this cannot double-count
   *
   * When a conversation *is* open both wires deliver the same message: the
   * conversation channel and the notification channel. Exactly one of them may
   * touch the count, so this is the single guard for both — an open thread is
   * read as it arrives, and `receive()` marks it read rather than counting it.
   * The notification store applies the same test before it renders a bell row;
   * the two agree because they ask the same question of the same store.
   */
  function noteMessageNotification(conversationId: number) {
    if (!Number.isFinite(conversationId)) return

    // Already looking at it — `receive()` has this, and marks it read.
    if (active.value?.id === conversationId) return

    const known = conversations.value.find((c) => c.id === conversationId)

    if (!known) {
      // A thread not in the loaded list: somebody writing for the first time.
      // If the list has never been loaded there is nothing to add a row to, so
      // move the total on its own — it is what the badge reads — and let the
      // next visit to the list fill in the detail.
      if (listLoaded.value) {
        void loadList()
      } else {
        totalUnread.value += 1
      }

      return
    }

    bumpUnread(conversationId)
  }

  /**
   * Read the badge from the server without loading the whole list.
   *
   * Called once when the shell mounts, so the count is right on the first
   * screen the user sees rather than only after they open chat. A dedicated
   * endpoint would be a third thing to keep in step with `unreadCountsFor`;
   * the list already answers this and the answer is in its meta.
   */
  async function loadUnreadBadge() {
    if (listLoaded.value) return

    try {
      const { data } = await conversationsApi.list()
      conversations.value = data.data
      totalUnread.value = data.meta?.total_unread ?? 0
      listLoaded.value = true
    } catch {
      // A wrong badge is worse than no badge, so leave it at zero and let the
      // chat list retry with its own error state.
    }
  }

  /** Move a conversation to the top of the list and update its preview. */
  function touch(id: number, message: Message) {
    const conversation = conversations.value.find((c) => c.id === id)

    if (!conversation) {
      // A thread that is not in the loaded list yet — someone messaging us for
      // the first time. Refetch rather than invent a row we cannot fill in.
      void loadList()

      return
    }

    conversation.last_message = message
    conversation.last_message_at = message.created_at
  }

  function reset() {
    conversations.value = []
    listLoaded.value = false
    totalUnread.value = 0
    close()
  }

  return {
    conversations,
    ordered,
    listLoaded,
    listLoading,
    listError,
    active,
    messages,
    activities,
    loading,
    hasError,
    loadingOlder,
    hasOlder,
    totalUnread,
    loadList,
    open,
    loadOlder,
    close,
    send,
    retry,
    receive,
    applyReadReceipt,
    markRead,
    noteMessageNotification,
    loadUnreadBadge,
    reset,
  }
})
