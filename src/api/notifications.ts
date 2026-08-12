import client from './client'
import type { AppNotification, NotificationPreferences, NotificationPreferencesMeta, PaginatedResponse } from '@/types'

interface NotificationPage extends PaginatedResponse<AppNotification> {
  meta: PaginatedResponse<AppNotification>['meta'] & { unread_count: number }
}

export const notificationsApi = {
  list(params: { page?: number; unread?: boolean; per_page?: number } = {}) {
    return client.get<NotificationPage>('/notifications', {
      params: {
        page: params.page,
        per_page: params.per_page,
        // Omitted rather than sent as `false`, so the backend's boolean() check
        // reads a genuinely absent filter.
        ...(params.unread ? { unread: 1 } : {}),
      },
    })
  },

  markRead(id: string) {
    return client.post<{ unread_count: number }>(`/notifications/${id}/read`)
  },

  markAllRead() {
    return client.post<{ unread_count: number }>('/notifications/read-all')
  },

  preferences() {
    return client.get<{ data: NotificationPreferences; meta: NotificationPreferencesMeta }>(
      '/me/notification-preferences',
    )
  },

  updatePreferences(preferences: NotificationPreferences) {
    return client.put<{ data: NotificationPreferences; meta: NotificationPreferencesMeta }>(
      '/me/notification-preferences',
      { preferences },
    )
  },
}
