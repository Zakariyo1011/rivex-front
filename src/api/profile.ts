import client from './client'
import type { User } from '@/types'

export interface UpdateProfilePayload {
  name?: string
  bio?: string
  age?: number
  location_name?: string
  visibility?: 'public' | 'private'
  avatar?: File
}

export const profileApi = {
  show(userId: number) {
    return client.get<{ data: User }>(`/users/${userId}`)
  },
  update(payload: UpdateProfilePayload) {
    const formData = new FormData()
    formData.append('_method', 'PUT')
    Object.entries(payload).forEach(([key, value]) => {
      if (value === undefined || value === null) return
      formData.append(key, value instanceof File ? value : String(value))
    })
    return client.post<{ data: User }>('/me/profile', formData)
  },
  reviews(userId: number) {
    return client.get(`/users/${userId}/reviews`)
  },
}
