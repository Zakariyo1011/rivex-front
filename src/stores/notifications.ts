import { defineStore } from 'pinia'
import { ref } from 'vue'
import { notificationsApi } from '@/api/notifications'
import { getEcho } from '@/composables/useEcho'
import type { AppNotification } from '@/types'

export const useNotificationsStore = defineStore('notifications', () => {
  const notifications = ref<AppNotification[]>([])
  const unreadCount = ref(0)
  const loaded = ref(false)
  let subscribedUserId: number | null = null

  async function fetch() {
    const { data } = await notificationsApi.list()
    notifications.value = data.data
    unreadCount.value = data.data.filter((n) => !n.read).length
    loaded.value = true
  }

  async function markRead(id: string) {
    const notification = notifications.value.find((n) => n.id === id)
    if (!notification || notification.read) return
    notification.read = true
    unreadCount.value = Math.max(0, unreadCount.value - 1)
    await notificationsApi.markRead(id)
  }

  async function markAllRead() {
    notifications.value.forEach((n) => (n.read = true))
    unreadCount.value = 0
    await notificationsApi.markAllRead()
  }

  function subscribe(userId: number) {
    if (subscribedUserId === userId) return
    subscribedUserId = userId

    getEcho()
      .private(`App.Models.User.${userId}`)
      .notification((notification: { id: string; type: string; title: string; body: string; [key: string]: unknown }) => {
        notifications.value.unshift({
          id: notification.id,
          type: notification.type,
          title: notification.title,
          body: notification.body,
          data: notification,
          read: false,
          created_at: new Date().toISOString(),
        })
        unreadCount.value += 1
      })
  }

  function reset() {
    notifications.value = []
    unreadCount.value = 0
    loaded.value = false
    subscribedUserId = null
  }

  return { notifications, unreadCount, loaded, fetch, markRead, markAllRead, subscribe, reset }
})
