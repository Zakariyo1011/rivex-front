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
  /** ISO-8601 in UTC, from `toApiTimestamp`. Never a bare wall-clock string. */
  start_at: string
  ends_at: string
  people_needed: number
  payment_type: string
  amount: number
}

export const activitiesApi = {
  list(filters: ActivityFilters = {}) {
    return client.get<PaginatedResponse<Activity>>('/activities', { params: filters })
  },
  show(id: number | string) {
    return client.get<{ data: Activity }>(`/activities/${id}`)
  },
  /**
   * @param filter `owned` (the default, and what this endpoint always
   *   returned), `joined` for other people's activities you took part in, or
   *   `all` for both.
   */
  mine(filter: 'owned' | 'joined' | 'all' = 'owned') {
    return client.get<{ data: Activity[] }>('/me/activities', { params: { filter } })
  },
  /**
   * Plain JSON, not multipart.
   *
   * It was multipart only because activities carried a cover image; with that
   * gone there is no file in the payload, and JSON keeps types intact on the
   * way over — `toFormData` stringified everything, so `people_needed` arrived
   * as "2" and every boolean as "true".
   */
  create(payload: CreateActivityPayload) {
    return client.post<{ data: Activity }>('/activities', payload)
  },
  update(id: number, payload: Partial<CreateActivityPayload>) {
    return client.put<{ data: Activity }>(`/activities/${id}`, payload)
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
