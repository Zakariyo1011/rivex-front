import client from './client'
import type { Activity, Conversation, Message, MessageReactionGroup } from '@/types'

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
  /**
   * Post a message, optionally answering another one.
   *
   * `reply_to_message_id` is omitted rather than sent as null when there is no
   * reply, so the server's validator sees a genuinely absent field. The server
   * checks that the id belongs to THIS conversation — a reply is a pointer the
   * client supplies, and an unchecked one would let Rivex quote a message from
   * a thread the reader was never in.
   */
  sendMessage(id: number, body: string, replyToMessageId?: number | null) {
    return client.post<{ data: Message }>(`/conversations/${id}/messages`, {
      body,
      ...(replyToMessageId ? { reply_to_message_id: replyToMessageId } : {}),
    })
  },

  /**
   * Set or replace the caller's reaction to a message.
   *
   * Nested under the conversation because that is the only model that knows
   * about membership — and because the route is scope-bound, so a message id
   * from another thread 404s rather than being resolved.
   *
   * Returns the message's whole reaction summary, which is the authoritative
   * answer the optimistic update is reconciled against.
   */
  react(conversationId: number, messageId: number, emoji: string) {
    return client.post<{ data: { message_id: number; reactions: MessageReactionGroup[] } }>(
      `/conversations/${conversationId}/messages/${messageId}/reactions`,
      { emoji },
    )
  },

  unreact(conversationId: number, messageId: number) {
    return client.delete<{ data: { message_id: number; reactions: MessageReactionGroup[] } }>(
      `/conversations/${conversationId}/messages/${messageId}/reactions`,
    )
  },
  markRead(id: number) {
    return client.post<{ total_unread: number }>(`/conversations/${id}/read`)
  },
}
