import client from './client'
import type { Dispute, NoShowReport } from '@/types'

export const noShowApi = {
  /** Reports filed AGAINST the caller that they may still answer. */
  mine() {
    return client.get<{ data: NoShowReport[] }>('/me/no-show-reports')
  },

  report(activityId: number, accusedId: number, note?: string) {
    return client.post<{ data: NoShowReport }>(`/activities/${activityId}/no-show`, {
      accused_id: accusedId,
      note,
    })
  },

  /** Accepting settles it immediately; disputing creates a Dispute for an admin. */
  accept(reportId: number, note?: string) {
    return client.post<{ data: NoShowReport }>(`/no-show-reports/${reportId}/respond`, {
      response: 'accept',
      note,
    })
  },

  dispute(reportId: number, note: string) {
    return client.post<{ data: Dispute }>(`/no-show-reports/${reportId}/respond`, {
      response: 'dispute',
      note,
    })
  },

  withdraw(reportId: number) {
    return client.post<{ data: NoShowReport }>(`/no-show-reports/${reportId}/withdraw`)
  },
}
