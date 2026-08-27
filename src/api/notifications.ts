import client from './client'
import type { AppNotification, NotificationPreferences, NotificationPreferencesMeta, PaginatedResponse } from '@/types'

interface NotificationPage extends PaginatedResponse<AppNotification> {
  meta: PaginatedResponse<AppNotification>['meta'] & { unread_count: number }
}

/**
 * The feed's category tabs.
 *
 * `null` is "all" and is expressed as an absent parameter rather than a
 * `category=all` the server would have to know to ignore. The server owns which
 * notification types belong to each of these — see NotificationController —
 * because that grouping has to hold for rows this client has never seen.
 */
export type NotificationCategoryKey =
  | null
  | 'social'
  | 'messages'
  | 'activities'
  | 'applications'
  | 'system'

export const notificationsApi = {
  list(
    params: {
      page?: number
      unread?: boolean
      per_page?: number
      category?: NotificationCategoryKey
    } = {},
  ) {
    return client.get<NotificationPage>('/notifications', {
      params: {
        page: params.page,
        per_page: params.per_page,
        // Omitted rather than sent as `false`, so the backend's boolean() check
        // reads a genuinely absent filter.
        ...(params.unread ? { unread: 1 } : {}),
        ...(params.category ? { category: params.category } : {}),
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
