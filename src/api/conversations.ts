import client from './client'
import type { Activity, Conversation, Message } from '@/types'

export interface MessagePage {
  data: Message[]
  meta: { next_cursor: string | null; has_more: boolean }
}

export const conversationsApi = {
  list() {
    return client.get<{ data: Conversation[]; meta: { total_unread: number } }>('/me/conversations')
  },
  show(id: number) {
    return client.get<{ data: Conversation }>(`/conversations/${id}`)
  },

  /**
   * Open the conversation with someone — the "Xabar" button.
   *
   * Deliberately not `create`. The endpoint is idempotent: pressing it twice,
   * from two tabs, or after already sharing four activities all return the same
   * conversation. The client does not check first and must not — the guarantee
   * is a unique index in the database, not a round trip.
   */
  openWith(userId: number) {
    return client.post<{ data: Conversation; created: boolean }>('/conversations/direct', {
      user_id: userId,
    })
  },

  /** Activities both people are in. Context on a direct thread, never its identity. */
  activities(id: number) {
    return client.get<{ data: Activity[] }>(`/conversations/${id}/activities`)
  },

  /**
   * Where an activity's chat lives. 404 while nobody has been accepted yet.
   *
   * Not derivable client-side: a two-person activity routes to the pair's
   * direct conversation, which carries no activity id.
   */
  forActivity(activityId: number) {
    return client.get<{ data: Conversation }>(`/activities/${activityId}/conversation`)
  },

  messages(id: number, cursor?: string | null) {
    return client.get<MessagePage>(`/conversations/${id}/messages`, {
      params: cursor ? { cursor } : undefined,
    })
  },
  sendMessage(id: number, body: string) {
    return client.post<{ data: Message }>(`/conversations/${id}/messages`, { body })
  },
  markRead(id: number) {
    return client.post<{ total_unread: number }>(`/conversations/${id}/read`)
  },
}
