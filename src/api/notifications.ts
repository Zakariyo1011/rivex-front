import client from './client'
import type { AppNotification, PaginatedResponse } from '@/types'

export const notificationsApi = {
  list() {
    return client.get<PaginatedResponse<AppNotification>>('/notifications')
  },
  markRead(id: string) {
    return client.post(`/notifications/${id}/read`)
  },
  markAllRead() {
    return client.post('/notifications/read-all')
  },
}
