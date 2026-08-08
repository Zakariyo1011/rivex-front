import client from './client'
import type { ActivityMatch, Message } from '@/types'

export const matchesApi = {
  list() {
    return client.get<{ data: ActivityMatch[] }>('/me/matches')
  },
  show(id: number) {
    return client.get<{ data: ActivityMatch }>(`/me/matches/${id}`)
  },
  messages(matchId: number) {
    return client.get<{ data: Message[] }>(`/matches/${matchId}/messages`)
  },
  sendMessage(matchId: number, body: string) {
    return client.post<{ data: Message }>(`/matches/${matchId}/messages`, { body })
  },
  markRead(matchId: number) {
    return client.post(`/matches/${matchId}/read`)
  },
}
