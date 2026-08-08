import client from './client'
import type { Application } from '@/types'

export const applicationsApi = {
  apply(activityId: number, message?: string) {
    return client.post<{ data: Application }>(`/activities/${activityId}/applications`, { message })
  },
  incoming(activityId: number) {
    return client.get<{ data: Application[] }>(`/activities/${activityId}/applications`)
  },
  mine() {
    return client.get<{ data: Application[] }>('/me/applications')
  },
  cancel(applicationId: number) {
    return client.post<{ data: Application }>(`/applications/${applicationId}/cancel`)
  },
  accept(applicationId: number) {
    return client.post<{ data: Application }>(`/applications/${applicationId}/accept`)
  },
  reject(applicationId: number) {
    return client.post<{ data: Application }>(`/applications/${applicationId}/reject`)
  },
}
