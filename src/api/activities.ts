import client from './client'
import type { Activity, PaginatedResponse } from '@/types'

export type ActivitySort = 'nearest' | 'newest' | 'popular' | 'starting_soon' | 'price_low' | 'price_high'

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night'

export interface ActivityFilters {
  /** Matched against title, description, location, category and region/district. */
  q?: string
  category_id?: number
  date?: 'today' | 'tomorrow' | string
  time_of_day?: TimeOfDay
  payment?: 'free' | 'paid'
  min_amount?: number
  max_amount?: number
  people_needed?: number
  verified_only?: boolean
  region_id?: number
  district_id?: number
  /** Only meaningful together with lng; enables distance sorting and radius. */
  lat?: number
  lng?: number
  radius_km?: number
  sort?: ActivitySort
  page?: number
}

export interface CreateActivityPayload {
  title: string
  category_id: number
  description?: string
  location_name: string
  region_id: number
  district_id?: number
  latitude?: number
  longitude?: number
  start_at: string
  duration_minutes?: number
  people_needed: number
  payment_type: string
  amount: number
  image?: File
}

function toFormData<T extends object>(payload: T) {
  const formData = new FormData()
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return
    formData.append(key, value instanceof File ? value : String(value))
  })
  return formData
}

export const activitiesApi = {
  list(filters: ActivityFilters = {}) {
    return client.get<PaginatedResponse<Activity>>('/activities', { params: filters })
  },
  show(id: number | string) {
    return client.get<{ data: Activity }>(`/activities/${id}`)
  },
  mine() {
    return client.get<{ data: Activity[] }>('/me/activities')
  },
  create(payload: CreateActivityPayload) {
    return client.post<{ data: Activity }>('/activities', toFormData(payload))
  },
  update(id: number, payload: Partial<CreateActivityPayload>) {
    const formData = toFormData(payload)
    formData.append('_method', 'PUT')
    return client.post<{ data: Activity }>(`/activities/${id}`, formData)
  },
  /** A reason is required — cancellation patterns feed the trust score. */
  cancel(id: number, reason: string, note?: string) {
    return client.post<{ data: Activity }>(`/activities/${id}/cancel`, { reason, note })
  },
  destroy(id: number) {
    return client.delete(`/activities/${id}`)
  },
  confirmCompletion(id: number) {
    return client.post<{ data: Activity }>(`/activities/${id}/confirm-completion`)
  },
  confirmParticipantCompletion(participantId: number) {
    return client.post<{ data: Activity }>(`/activity-participants/${participantId}/confirm-completion`)
  },
  review(id: number, payload: { reviewee_id: number; rating?: number; comment?: string; is_no_show?: boolean }) {
    return client.post(`/activities/${id}/review`, payload)
  },
}
