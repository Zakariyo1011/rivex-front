import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { conversationsApi } from '@/api/conversations'
import { describeApiError } from '@/composables/useApiError'
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

  /**
   * The message the composer is currently answering, or null.
   *
   * Store state rather than component state, for the same reason the message
   * list is: the reply is started from a *bubble* and consumed by the
   * *composer*, which are siblings. Passing it between them through the view
   * would make the view a router for one piece of state, and closing the
   * conversation would have to remember to clear it — which is exactly the kind
   * of thing that gets forgotten and leaves a reply preview hanging over the
   * next thread you open.
   */
  const replyingTo = ref<Message | null>(null)

  function startReply(message: Message) {
    // A message that has not been accepted by the server yet has no real id to
    // point at, and pointing at the temporary negative one would send a reply
    // to a message that does not exist.
    if (message.id < 0) return

    replyingTo.value = message
  }

  function cancelReply() {
    replyingTo.value = null
  }

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
    // Otherwise the reply preview survives into the next conversation opened,
    // pointing at a message from a thread the composer is no longer in.
    replyingTo.value = null
  }

  // -- sending --------------------------------------------------------------

  async function send(body: string): Promise<boolean> {
    const conversation = active.value
    if (!conversation || !auth.user || !body.trim()) return false

    const tempId = -Date.now()

    // Captured before the await and before the composer is cleared: the reply
    // target is cleared as soon as the message is sent (so the composer returns
    // to normal immediately), and reading it after the round trip would find
    // nothing — or worse, a different message the user has since replied to.
    const parent = replyingTo.value

    const optimistic: Message = {
      id: tempId,
      conversation_id: conversation.id,
      body,
      type: 'text',
      sender: auth.user,
      // The preview is built locally so the reply renders as a reply
      // immediately rather than flickering into one when the server answers.
      // The server's own version replaces it below.
      reply_to: parent
        ? {
            id: parent.id,
            deleted: false,
            body: parent.body,
            type: parent.type,
            sender: parent.sender,
          }
        : null,
      reactions: [],
      read_at: null,
      created_at: new Date().toISOString(),
      pending: true,
    }

    messages.value.push(optimistic)
    replyingTo.value = null

    try {
      const { data } = await conversationsApi.sendMessage(conversation.id, body, parent?.id ?? null)

      const index = messages.value.findIndex((m) => m.id === tempId)
      if (index !== -1) messages.value.splice(index, 1)

      // The broadcast of our own message may have arrived first.
      if (!messages.value.some((m) => m.id === data.data.id)) {
        messages.value.push(data.data)
      }

      touch(conversation.id, data.data)

      return true
    } catch (e) {
      const failed = messages.value.find((m) => m.id === tempId)
      if (failed) {
        failed.pending = false
        failed.failed = true
        // WHY it failed, not just that it did.
        //
        // Every failure used to render the same "Yuborilmadi", which is the
        // least useful thing a chat can say: a message refused because the
        // other person blocked you, one refused for rate limiting, and one that
        // never left the browser all need different reactions from the sender,
        // and retrying is only worth offering for some of them. The reason is
        // derived by status and is deliberately free of backend detail — see
        // describeApiError.
        failed.failed_reason = describeApiError(e, 'message send')
      }

      // The reply target is restored so the retry is still a reply. It was
      // cleared optimistically when the send started.
      if (parent) replyingTo.value = parent

      return false
    }
  }

  /**
   * Re-send a message whose first attempt failed, in place.
   *
   * The reply target is restored before re-sending, so retrying a failed reply
   * sends a reply rather than silently degrading into a loose message — the
   * failed row still carries its preview, and `send()` reads `replyingTo`.
   */
  async function retry(message: Message): Promise<boolean> {
    const index = messages.value.findIndex((m) => m.id === message.id)
    if (index !== -1) messages.value.splice(index, 1)

    const parentId = message.reply_to?.id ?? null

    if (parentId !== null) {
      replyingTo.value = messages.value.find((m) => m.id === parentId) ?? replyingTo.value
    }

    return send(message.body)
  }

  /**
   * Reactions on a message that failed to send are meaningless, and so is a
   * stale failure reason once the row is gone. Kept together so a caller
   * dismissing a failed message does not have to know about either.
   */
  function discardFailed(message: Message) {
    messages.value = messages.value.filter((m) => m.id !== message.id)
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

  // -- reactions ------------------------------------------------------------

  /**
   * Apply one person's reaction change to a message, in place.
   *
   * The single primitive behind both the optimistic update and the realtime
   * delta, so a reaction the user makes and a reaction that arrives on the wire
   * cannot end up applied by two different sets of rules.
   *
   * `previousEmoji` is what makes a *change* work. Without it a change reads as
   * an addition and the badge being left never comes down — so a person who
   * switches from 👍 to ❤️ would appear to hold both.
   */
  function applyReaction(
    messageId: number,
    userId: number,
    emoji: string | null,
    previousEmoji: string | null,
  ) {
    const message = messages.value.find((m) => m.id === messageId)
    if (!message) return

    const groups = [...(message.reactions ?? [])].map((g) => ({ ...g, user_ids: [...g.user_ids] }))

    const drop = (target: string | null) => {
      if (!target) return
      const group = groups.find((g) => g.emoji === target)
      if (!group) return

      group.user_ids = group.user_ids.filter((id) => id !== userId)
      group.count = group.user_ids.length
    }

    // The user is removed from wherever they were, then added where they now
    // are — never both at once, which is what keeps one-reaction-per-person
    // true on the client as well as in the database.
    drop(previousEmoji)

    // Belt and braces: a lost frame could leave a stale membership behind, and
    // re-applying the same delta must not double-count. Sweeping every group is
    // O(5) and makes this idempotent.
    groups.forEach((group) => {
      if (group.emoji === emoji) return
      const before = group.user_ids.length
      group.user_ids = group.user_ids.filter((id) => id !== userId)
      if (group.user_ids.length !== before) group.count = group.user_ids.length
    })

    if (emoji) {
      const existing = groups.find((g) => g.emoji === emoji)

      if (existing) {
        if (!existing.user_ids.includes(userId)) {
          existing.user_ids.push(userId)
          existing.count = existing.user_ids.length
        }
      } else {
        groups.push({ emoji, count: 1, user_ids: [userId] })
      }
    }

    message.reactions = groups.filter((g) => g.count > 0)
  }

  /** A reaction change arriving on the conversation channel. */
  function receiveReaction(payload: {
    message_id: number
    user_id: number
    emoji: string | null
    previous_emoji: string | null
  }) {
    applyReaction(payload.message_id, payload.user_id, payload.emoji, payload.previous_emoji)
  }

  /**
   * Toggle the current user's reaction to a message.
   *
   * Tapping the emoji already held removes it; tapping a different one replaces
   * it. That is the same rule the database enforces with its unique key, so the
   * client and the server agree about what a second tap means.
   *
   * Optimistic, with the server's authoritative summary replacing the guess —
   * and a rollback that restores the exact previous groups, because an
   * optimistic update without a working rollback is a lie that is usually true.
   */
  async function toggleReaction(message: Message, emoji: string): Promise<void> {
    const conversation = active.value
    if (!conversation || !auth.user || message.id < 0) return

    const userId = auth.user.id
    const previousGroups = (message.reactions ?? []).map((g) => ({ ...g, user_ids: [...g.user_ids] }))
    const current = previousGroups.find((g) => g.user_ids.includes(userId))?.emoji ?? null
    const removing = current === emoji

    applyReaction(message.id, userId, removing ? null : emoji, current)

    try {
      const { data } = removing
        ? await conversationsApi.unreact(conversation.id, message.id)
        : await conversationsApi.react(conversation.id, message.id, emoji)

      const target = messages.value.find((m) => m.id === data.data.message_id)
      if (target) target.reactions = data.data.reactions
    } catch {
      const target = messages.value.find((m) => m.id === message.id)
      if (target) target.reactions = previousGroups
    }
  }

  /** The emoji this user currently holds on a message, if any. */
  function myReaction(message: Message): string | null {
    const userId = auth.user?.id
    if (userId === undefined) return null

    return (message.reactions ?? []).find((g) => g.user_ids.includes(userId))?.emoji ?? null
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
    replyingTo,
    loadList,
    open,
    loadOlder,
    close,
    send,
    retry,
    discardFailed,
    startReply,
    cancelReply,
    receive,
    applyReaction,
    receiveReaction,
    toggleReaction,
    myReaction,
    applyReadReceipt,
    markRead,
    noteMessageNotification,
    loadUnreadBadge,
    reset,
  }
})
