import client from './client'
import type {
  FollowCounts,
  OnboardingState,
  PhoneState,
  ProfileCompletion,
  SecurityOverview,
  User,
  UserCounters,
  UsernamePolicy,
  WalletSummary,
} from '@/types'

interface AuthResponse {
  user: User
  token: string
  /** True when this callback created the account rather than signing it in. */
  is_new_user: boolean
}

/**
 * Authentication is Google, and only Google.
 *
 * The client never sees the client secret and never talks to Google's token
 * endpoint. It asks the backend for a URL, sends the browser there, and hands
 * the returned `code` straight back — the backend proves the identity itself.
 * A `sub` supplied by this layer would be worth nothing and is never sent.
 */
export const authApi = {
  /** Whether the button should be live, so the screen can be honest. */
  googleStatus() {
    return client.get<{ data: { configured: boolean; fake: boolean } }>('/auth/google/status')
  },

  /**
   * Step 1 — mint a single-use `state` and get the consent URL.
   *
   * `redirect_uri` is sent so a local and a deployed frontend can share one
   * backend; the server accepts it only if it matches a configured origin.
   */
  googleRedirect(redirectUri: string) {
    return client.get<{ data: { url: string; state: string; expires_in: number } }>(
      '/auth/google/redirect',
      { params: { redirect_uri: redirectUri } },
    )
  },

  /** Step 2 — redeem the code. `error` is what a cancelled consent screen sends. */
  googleCallback(payload: { code?: string; state?: string; error?: string }) {
    return client.post<AuthResponse>('/auth/google/callback', payload)
  },

  /** Attach a Google account to a session that already exists. */
  googleLink(payload: { code: string; state: string }) {
    return client.post<{ message: string; user: User }>('/auth/google/link', payload)
  },

  logout() {
    return client.post('/auth/logout')
  },

  logoutAll() {
    return client.post<{ message: string }>('/auth/logout-all')
  },

  /** `onboarding` and the rest sit beside `data` — all owner-only. */
  me() {
    return client.get<{
      data: User
      onboarding: OnboardingState
      completion: ProfileCompletion
      username_policy: UsernamePolicy
      follow_counts: FollowCounts
      counters: UserCounters
      wallet: WalletSummary
      phone: PhoneState
    }>('/me')
  },

  /**
   * A Google-only account has no password to re-prove, so it confirms deletion
   * by typing its handle back instead.
   */
  deleteAccount(payload: { password?: string; confirmation?: string }) {
    return client.delete<{ message: string }>('/me', { data: payload })
  },

  security() {
    return client.get<{ data: SecurityOverview }>('/me/security')
  },

  /**
   * A password is optional now — a second way in, not the credential the
   * account rests on. `current_password` is omitted when there is none yet.
   */
  changePassword(payload: {
    current_password?: string
    password: string
    password_confirmation: string
  }) {
    return client.post<{ message: string }>('/me/password', payload)
  },
}

/**
 * The phone number, as profile data.
 *
 * Deliberately its own object rather than part of `authApi`: it stopped being
 * an authentication concern when Google took over sign-in, and grouping it with
 * login was what made it feel like one.
 */
export const phoneApi = {
  show() {
    return client.get<{ data: PhoneState }>('/me/phone')
  },

  /** Step 1: claim a number and receive a code on it. */
  request(phone: string) {
    return client.post<{ message: string; data: PhoneState; phone: string }>('/me/phone', { phone })
  },

  /** Step 2: only the code — the number is the one the server recorded. */
  confirm(code: string) {
    return client.post<{ message: string; data: PhoneState; user: User }>('/me/phone/confirm', {
      code,
    })
  },

  resend() {
    return client.post<{ message: string; data: PhoneState }>('/me/phone/resend')
  },

  cancelPending() {
    return client.delete<{ message: string; data: PhoneState }>('/me/phone/pending')
  },

  remove() {
    return client.delete<{ message: string; data: PhoneState }>('/me/phone')
  },
}
