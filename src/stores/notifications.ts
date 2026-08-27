import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { notificationsApi, type NotificationCategoryKey } from '@/api/notifications'
import { useEchoChannel } from '@/composables/useEchoChannel'
import { onEchoReconnect } from '@/composables/useEcho'
import { useToast } from '@/composables/useToast'
import { useChatStore } from '@/stores/chat'
import type { AppNotification } from '@/types'

/**
 * The notification centre's state, shared by the bell and the full page.
 *
 * Both surfaces read the same list, so marking something read in the dropdown
 * is already reflected on /notifications and vice versa — keeping two copies
 * was how the badge and the list used to disagree.
 */
export const useNotificationsStore = defineStore('notifications', () => {
  const toast = useToast()

  const notifications = ref<AppNotification[]>([])
  const unreadCount = ref(0)
  const loaded = ref(false)
  const loading = ref(false)
  const loadingMore = ref(false)
  const currentPage = ref(1)
  const lastPage = ref(1)
  const unreadOnly = ref(false)

  /**
   * The category tab being viewed, or null for everything.
   *
   * A server-side filter rather than a client-side `.filter()` over the loaded
   * page, because the list is paginated: filtering locally would show "3
   * follows" out of the twenty rows that happen to be loaded and silently omit
   * the rest, which is worse than not offering the tab.
   */
  const category = ref<NotificationCategoryKey>(null)

  /**
   * The conversation the user is currently reading, if any.
   *
   * Set by the chat store. A `new_message` notification for this conversation
   * is dropped rather than badged: the user is looking at the message as it
   * arrives, and a bell that lights up for something already on screen is how
   * people learn to ignore the bell.
   *
   * Held here rather than read from the chat store so the dependency runs one
   * way — chat knows about notifications, notifications knows nothing about
   * chat.
   */
  const activeConversationId = ref<number | null>(null)

  function setActiveConversation(id: number | null) {
    activeConversationId.value = id

    if (id !== null) dismissForConversation(id)
  }

  /** Drop unread rows for a conversation the user has just read. */
  function dismissForConversation(conversationId: number) {
    const affected = notifications.value.filter(
      (n) => n.type === 'new_message' && !n.read && Number(n.data.conversation_id) === conversationId,
    )

    if (affected.length === 0) return

    affected.forEach((n) => (n.read = true))
    unreadCount.value = Math.max(0, unreadCount.value - affected.length)

    if (unreadOnly.value) {
      notifications.value = notifications.value.filter((n) => !affected.includes(n))
    }
  }

  /** Drives the "load more" affordance and the infinite-scroll sentinel. */
  const hasMore = computed(() => currentPage.value < lastPage.value)

  /**
   * The live subscription follows this rather than being started imperatively,
   * so logging out (id -> null) tears it down and logging in as someone else
   * moves it, with no chance of listening on the previous user's channel.
   */
  const subscribedUserId = ref<number | null>(null)

  function applyPage(
    data: { data: AppNotification[]; meta: { current_page: number; last_page: number; unread_count: number } },
    append: boolean,
  ) {
    notifications.value = append ? [...notifications.value, ...data.data] : data.data
    currentPage.value = data.meta.current_page
    lastPage.value = data.meta.last_page
    unreadCount.value = data.meta.unread_count
    loaded.value = true
  }

  async function fetch() {
    loading.value = true
    try {
      const { data } = await notificationsApi.list({
        unread: unreadOnly.value,
        category: category.value,
      })
      applyPage(data, false)
    } finally {
      loading.value = false
    }
  }

  async function loadMore() {
    if (!hasMore.value || loadingMore.value) return

    loadingMore.value = true
    try {
      const { data } = await notificationsApi.list({
        page: currentPage.value + 1,
        unread: unreadOnly.value,
        category: category.value,
      })
      applyPage(data, true)
    } finally {
      loadingMore.value = false
    }
  }

  /**
   * Read the unread count without disturbing the list.
   *
   * 🔴 Found in browser QA. The badge is drawn on every screen, and the only
   * thing that ever populated it was `fetch()` — which ran when the bell's
   * dropdown was opened. Once the bell became a link to the page (the dropdown
   * being the thing the notification centre needed to stop being), nothing
   * fetched the count until the user actually visited `/notifications`. So a
   * reload anywhere else showed no badge at all while nine notifications sat
   * unread, and the chat badge beside it — which has had its own loader since
   * 11.8 — showed its count correctly, which made the missing one look
   * deliberate.
   *
   * `per_page: 1` because only `meta.unread_count` is wanted; the rows are
   * thrown away. Deliberately does NOT write to `notifications`, `currentPage`
   * or `loaded`: this runs when the shell mounts, possibly while the page is
   * showing a filtered list, and overwriting that list with an unfiltered first
   * page would make the visible feed disagree with its own tabs.
   *
   * The chat store's `loadUnreadBadge()` is the same idea, and this is
   * deliberately shaped like it.
   */
  async function loadUnreadBadge() {
    if (loaded.value) return

    try {
      const { data } = await notificationsApi.list({ per_page: 1 })
      unreadCount.value = data.meta.unread_count
    } catch {
      // A wrong badge is worse than no badge, so leave it and let the page
      // itself report the error when it is opened.
    }
  }

  async function setUnreadOnly(value: boolean) {
    if (unreadOnly.value === value) return
    unreadOnly.value = value
    await fetch()
  }

  async function setCategory(value: NotificationCategoryKey) {
    if (category.value === value) return
    category.value = value
    await fetch()
  }

  async function markRead(id: string) {
    const notification = notifications.value.find((n) => n.id === id)
    if (!notification || notification.read) return

    // Optimistic: the badge should drop the instant it is tapped.
    notification.read = true
    unreadCount.value = Math.max(0, unreadCount.value - 1)

    try {
      const { data } = await notificationsApi.markRead(id)
      unreadCount.value = data.unread_count
    } catch {
      notification.read = false
      unreadCount.value += 1
    }

    // In the unread-only view the row no longer belongs in the list.
    if (unreadOnly.value) {
      notifications.value = notifications.value.filter((n) => n.id !== id)
    }
  }

  async function markAllRead() {
    const previous = notifications.value.map((n) => n.read)

    notifications.value.forEach((n) => (n.read = true))
    unreadCount.value = 0

    try {
      await notificationsApi.markAllRead()
      if (unreadOnly.value) notifications.value = []
    } catch {
      notifications.value.forEach((n, index) => (n.read = previous[index] ?? false))
      unreadCount.value = previous.filter((read) => !read).length
    }
  }

  /**
   * Whether a live row belongs in the list as it is currently filtered.
   *
   * The client answers this for the *incoming* row only. Which types belong to
   * which category is the server's decision (see NotificationController), so
   * this asks the same question the server answered when the page was fetched
   * rather than keeping a second copy of the grouping that would drift from it.
   */
  const CATEGORY_TYPES: Record<string, string[]> = {
    social: ['new_follower', 'follow_request', 'follow_accepted'],
    messages: ['new_message'],
    activities: ['activity_cancelled', 'activity_reminder', 'participant_joined'],
    applications: ['new_application', 'application_accepted', 'application_rejected'],
    system: [
      'payment_successful',
      'payment_refunded',
      'withdrawal_resolved',
      'dispute_resolved',
      'no_show_reported',
      'verification_approved',
      'verification_rejected',
    ],
  }

  function matchesCurrentFilter(notification: AppNotification): boolean {
    if (category.value === null) return true

    return CATEGORY_TYPES[category.value]?.includes(notification.type) ?? true
  }

  /**
   * A notification arriving over the socket.
   *
   * Laravel's broadcast payload is the notification's `toArray()` plus an `id`
   * and a `type`, so it has to be reshaped into the same form the REST endpoint
   * returns — otherwise a live row and a reloaded row render differently.
   */
  function handleIncoming(payload: Record<string, unknown> & { id: string; type: string }) {
    // Reverb can deliver the same frame twice across a reconnect, and the row
    // may already be present from a refetch that raced it.
    if (notifications.value.some((n) => n.id === payload.id)) return

    // Already on screen — see activeConversationId. The server marks the row
    // read when the conversation is opened, so nothing is lost by not badging
    // it here.
    if (
      payload.type === 'new_message' &&
      Number(payload.conversation_id) === activeConversationId.value
    ) {
      return
    }

    // The chat badge rides on this same frame.
    //
    // `App.Models.User.{id}` is the only channel a client holds open from every
    // screen, so it is the only place the chat count can learn about a message
    // arriving while the user is somewhere other than that conversation. The
    // chat store owns the guard against double-counting — see
    // `noteMessageNotification` — and this deliberately does not duplicate it:
    // two copies of "is this thread open" is how a badge starts disagreeing
    // with the screen it points at.
    if (payload.type === 'new_message') {
      useChatStore().noteMessageNotification(Number(payload.conversation_id))
    }

    const notification: AppNotification = {
      id: payload.id,
      type: payload.type,
      title: String(payload.title ?? ''),
      body: String(payload.body ?? ''),
      data: payload,
      read: false,
      created_at: new Date().toISOString(),

      // The actor and the viewer's relationship with them, resolved server-side
      // on the frame itself.
      //
      // These used to be absent here, and it showed: a follow arriving while
      // the app was open rendered with no face, no @handle and no Follow-back
      // button, and grew them only when the page was reloaded and the REST
      // endpoint hydrated the row properly. The one notification the product
      // most wants to be live was the one that needed a refresh.
      //
      // Undefined rather than null when the server sent nothing, so a row with
      // no actor (a refund) renders its event icon rather than an empty avatar
      // — the template branches on presence.
      actor: (payload.actor as AppNotification['actor']) ?? undefined,
      relationship: (payload.relationship as AppNotification['relationship']) ?? undefined,
    }

    // The badge counts everything unread regardless of which tab is open, so it
    // moves whether or not this row belongs in the visible list.
    unreadCount.value += 1

    // Only prepend to the list the user is actually looking at. A new row is
    // always unread, so the unread filter always admits it; the category filter
    // may not, and inserting a follow into a list the user has narrowed to
    // messages would corrupt what that tab claims to be. It is not lost —
    // switching tabs refetches from the server.
    if (matchesCurrentFilter(notification)) notifications.value.unshift(notification)

    toast.info(notification.title)
  }

  useEchoChannel(
    () => (subscribedUserId.value ? `App.Models.User.${subscribedUserId.value}` : null),
    { onNotification: handleIncoming as (payload: never) => void },
  )

  // Events that arrived while the socket was down are simply gone — there is no
  // replay — so the badge has to be re-read rather than left stale.
  onEchoReconnect(() => {
    if (subscribedUserId.value) void fetch()
  })

  function subscribe(userId: number) {
    subscribedUserId.value = userId
  }

  function reset() {
    notifications.value = []
    unreadCount.value = 0
    loaded.value = false
    currentPage.value = 1
    lastPage.value = 1
    unreadOnly.value = false
    category.value = null
    subscribedUserId.value = null
  }

  return {
    notifications,
    unreadCount,
    loaded,
    loading,
    loadingMore,
    hasMore,
    unreadOnly,
    category,
    fetch,
    loadMore,
    loadUnreadBadge,
    setUnreadOnly,
    setCategory,
    markRead,
    markAllRead,
    setActiveConversation,
    dismissForConversation,
    subscribe,
    reset,
    handleIncoming,
  }
})
