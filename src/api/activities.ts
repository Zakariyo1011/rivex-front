import client from './client'
import type { Activity, PaginatedResponse, Payment } from '@/types'

export interface ActivityFilters {
  q?: string
  category_id?: number
  date?: 'today' | 'tomorrow' | string
  payment?: 'free' | 'paid'
  min_amount?: number
  max_amount?: number
  verified_only?: boolean
  lat?: number
  lng?: number
  radius_km?: number
  sort?: 'nearest' | 'newest' | 'price_low' | 'price_high'
  page?: number
}

export interface CreateActivityPayload {
  title: string
  category_id: number
  description?: string
  location_name: string
  latitude?: number
  longitude?: number
  start_at: string
  duration_minutes?: number
  people_needed: number
  payment_type: string
  amount: number
  image?: File
}

function toFormData(payload: Record<string, unknown>) {
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
  cancel(id: number) {
    return client.post<{ data: Activity }>(`/activities/${id}/cancel`)
  },
  complete(id: number) {
    return client.post<{ data: Activity }>(`/activities/${id}/complete`)
  },
  destroy(id: number) {
    return client.delete(`/activities/${id}`)
  },
  pay(id: number, recipientId?: number) {
    return client.post<{ data: Payment }>(`/activities/${id}/pay`, { recipient_id: recipientId })
  },
  myPayment(id: number) {
    return client.get<{ data: Payment | null }>(`/activities/${id}/payment`)
  },
  review(id: number, payload: { reviewee_id: number; rating?: number; comment?: string; is_no_show?: boolean }) {
    return client.post(`/activities/${id}/review`, payload)
  },
}
