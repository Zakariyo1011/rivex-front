import client from './client'
import type { Block } from '@/types'

export type ReportReason =
  | 'fake_account'
  | 'harassment'
  | 'scam'
  | 'unsafe_behavior'
  | 'inappropriate_content'
  | 'no_show'
  | 'payment_problem'
  | 'other'

export const safetyApi = {
  report(userId: number, reason: ReportReason, description?: string) {
    return client.post(`/users/${userId}/report`, { reason, description })
  },
  block(userId: number) {
    return client.post(`/users/${userId}/block`)
  },
  unblock(userId: number) {
    return client.delete(`/users/${userId}/block`)
  },
  myBlocks() {
    return client.get<{ data: Block[] }>('/me/blocks')
  },
}
