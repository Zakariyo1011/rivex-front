import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api/auth'
import { useNotificationsStore } from '@/stores/notifications'
import { disconnectEcho } from '@/composables/useEcho'
import type {
  FollowCounts,
  OnboardingState,
  ProfileCompletion,
  User,
  UsernamePolicy,
} from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(localStorage.getItem('rivex_token'))
  const pendingPhone = ref<string | null>(null)
  const onboarding = ref<OnboardingState | null>(null)
  /** Owner-only, served beside /me. Never present for anyone else's profile. */
  const completion = ref<ProfileCompletion | null>(null)
  /**
   * Owner-only handle change policy, also from /me. The edit screen gates on
   * this so the cooldown is applied before the write rather than discovered by
   * it — see UsernamePolicy.
   */
  const usernamePolicy = ref<UsernamePolicy | null>(null)
  /**
   * The owner's own follower/following totals, plus how many requests are
   * waiting. Always present for the owner — `who_can_see_followers` governs who
   * *else* may see the numbers, never the account holder.
   */
  const followCounts = ref<FollowCounts | null>(null)
  let inFlight: Promise<unknown> | null = null

  const isAuthenticated = computed(() => !!token.value)
  const isIdentityVerified = computed(() => user.value?.verification_status === 'verified')

  function setSession(newUser: User, newToken: string) {
    user.value = newUser
    token.value = newToken
    localStorage.setItem('rivex_token', newToken)
  }

  function clearSession() {
    user.value = null
    token.value = null
    onboarding.value = null
    completion.value = null
    usernamePolicy.value = null
    followCounts.value = null
    inFlight = null
    localStorage.removeItem('rivex_token')
    useNotificationsStore().reset()
    disconnectEcho()
  }

  async function register(payload: {
    name: string
    phone: string
    password: string
    password_confirmation: string
  }) {
    const { data } = await authApi.register(payload)
    setSession(data.user, data.token)
    pendingPhone.value = payload.phone
    return data
  }

  async function login(payload: { phone: string; password: string }) {
    const { data } = await authApi.login(payload)
    setSession(data.user, data.token)
    return data
  }

  async function logout() {
    try {
      await authApi.logout()
    } finally {
      clearSession()
    }
  }

  async function deleteAccount(password: string) {
    await authApi.deleteAccount(password)
    clearSession()
  }

  async function fetchMe() {
    const { data } = await authApi.me()
    user.value = data.data
    onboarding.value = data.onboarding ?? null
    completion.value = data.completion ?? null
    usernamePolicy.value = data.username_policy ?? null
    followCounts.value = data.follow_counts ?? null
    return data.data
  }

  /**
   * Fetches /me at most once per session, and de-duplicates concurrent callers
   * so the router guard and the app shell cannot fire two requests on load.
   * Returns silently on failure — a network blip must not lock the user out;
   * the axios 401 interceptor already handles a genuinely dead session.
   */
  function ensureLoaded() {
    if (!token.value) return Promise.resolve()
    if (onboarding.value) return Promise.resolve()

    inFlight ??= fetchMe()
      .catch(() => undefined)
      .finally(() => {
        inFlight = null
      })

    return inFlight
  }

  async function verifyPhone(code: string) {
    if (!pendingPhone.value && user.value) pendingPhone.value = user.value.phone ?? null
    if (!pendingPhone.value) throw new Error('No phone pending verification')
    await authApi.verifyPhone({ phone: pendingPhone.value, code })
    await fetchMe()
  }

  async function resendOtp() {
    if (!pendingPhone.value && user.value) pendingPhone.value = user.value.phone ?? null
    if (!pendingPhone.value) throw new Error('No phone pending verification')
    return authApi.resendOtp({ phone: pendingPhone.value })
  }

  return {
    user,
    token,
    onboarding,
    completion,
    usernamePolicy,
    followCounts,
    isAuthenticated,
    isIdentityVerified,
    pendingPhone,
    ensureLoaded,
    register,
    login,
    logout,
    deleteAccount,
    fetchMe,
    verifyPhone,
    resendOtp,
    setSession,
    clearSession,
  }
}, {
  persist: {
    key: 'rivex-auth',
    pick: ['user', 'pendingPhone'],
  },
})
