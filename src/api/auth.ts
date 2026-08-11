import client from './client'
import type { User } from '@/types'

interface AuthResponse {
  user: User
  token: string
}

export const authApi = {
  register(payload: { name: string; phone: string; password: string; password_confirmation: string }) {
    return client.post<AuthResponse>('/auth/register', payload)
  },
  login(payload: { phone: string; password: string }) {
    return client.post<AuthResponse>('/auth/login', payload)
  },
  logout() {
    return client.post('/auth/logout')
  },
  verifyPhone(payload: { phone: string; code: string }) {
    return client.post<{ message: string }>('/auth/verify-phone', payload)
  },
  resendOtp(payload: { phone: string }) {
    return client.post<{ message: string }>('/auth/resend-otp', payload)
  },
  me() {
    return client.get<{ data: User }>('/me')
  },
  deleteAccount(password: string) {
    return client.delete<{ message: string }>('/me', { data: { password } })
  },
}
