import client from './client'
import type {
  FollowCounts,
  OnboardingState,
  ProfileCompletion,
  User,
  UserCounters,
  UsernamePolicy,
} from '@/types'

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
  /** `onboarding` sits beside `data` — it is private to the caller and is
   *  deliberately absent from the shared public-profile resource. */
  me() {
    return client.get<{
      data: User
      onboarding: OnboardingState
      completion: ProfileCompletion
      username_policy: UsernamePolicy
      follow_counts: FollowCounts
      counters: UserCounters
    }>('/me')
  },
  deleteAccount(password: string) {
    return client.delete<{ message: string }>('/me', { data: { password } })
  },

  /** Ends every other session — the server keeps only the current token. */
  changePassword(payload: {
    current_password: string
    password: string
    password_confirmation: string
  }) {
    return client.post<{ message: string }>('/me/password', payload)
  },

  /** Step 1 of the phone change: sends a code to the NEW number. */
  requestPhoneChange(phone: string) {
    return client.post<{ message: string }>('/me/phone/request', { phone })
  },

  /** Step 2: proves the user holds the new number, then moves it over. */
  confirmPhoneChange(payload: { phone: string; code: string }) {
    return client.post<{ message: string; phone: string }>('/me/phone/confirm', payload)
  },
}
