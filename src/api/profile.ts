import client from './client'
import type { User } from '@/types'

export interface UpdateProfilePayload {
  name?: string
  display_name?: string
  bio?: string
  age?: number
  location_name?: string
  avatar?: File
  // Visibility moved to PUT /me/privacy, where it sits with the controls it
  // has to agree with. See @/api/privacy.
}

export interface UsernameAvailability {
  available: boolean
  reason: string | null
}

export const profileApi = {
  /** Legacy id route. Still the one used by internal links that hold an id. */
  show(userId: number) {
    return client.get<{ data: User }>(`/users/${userId}`)
  },
  /** Canonical public profile. Same payload, addressed by handle. */
  showByUsername(username: string) {
    return client.get<{ data: User }>(`/u/${encodeURIComponent(username)}`)
  },
  checkUsername(username: string) {
    return client.get<UsernameAvailability>('/username/available', { params: { username } })
  },
  usernameSuggestions() {
    return client.get<{ data: string[] }>('/username/suggestions')
  },
  updateUsername(username: string) {
    return client.put<{ data: User }>('/me/username', { username })
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
