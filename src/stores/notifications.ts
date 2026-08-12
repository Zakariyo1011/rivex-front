import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { notificationsApi } from '@/api/notifications'
import { useEchoChannel } from '@/composables/useEchoChannel'
import { onEchoReconnect } from '@/composables/useEcho'
import { useToast } from '@/composables/useToast'
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
      const { data } = await notificationsApi.list({ unread: unreadOnly.value })
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
      })
      applyPage(data, true)
    } finally {
      loadingMore.value = false
    }
  }

  async function setUnreadOnly(value: boolean) {
    if (unreadOnly.value === value) return
    unreadOnly.value = value
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

    const notification: AppNotification = {
      id: payload.id,
      type: payload.type,
      title: String(payload.title ?? ''),
      body: String(payload.body ?? ''),
      data: payload,
      read: false,
      created_at: new Date().toISOString(),
    }

    // Only prepend to the list the user is actually looking at. An unread item
    // belongs in both views, so this is really about not corrupting a filtered
    // list with rows that do not match it — and a new one is always unread.
    notifications.value.unshift(notification)
    unreadCount.value += 1

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
    fetch,
    loadMore,
    setUnreadOnly,
    markRead,
    markAllRead,
    subscribe,
    reset,
    handleIncoming,
  }
})
