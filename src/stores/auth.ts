import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi, phoneApi } from '@/api/auth'
import { useNotificationsStore } from '@/stores/notifications'
import { useFollowStore } from '@/stores/follows'
import { disconnectEcho } from '@/composables/useEcho'
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

/**
 * Where the OAuth `state` waits while the browser is at Google.
 *
 * sessionStorage, not the store: the round trip goes through a full page load,
 * so anything held in memory is gone by the time the callback runs. Scoped to
 * the tab, so two sign-ins in two tabs cannot overwrite each other's state.
 */
const GOOGLE_STATE_KEY = 'rivex_google_state'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(localStorage.getItem('rivex_token'))

  /**
   * The phone number's state, served beside /me.
   *
   * Not an authentication concern any more — it is profile data, and it lives
   * here only because /me is already fetched on boot and the profile screen
   * would otherwise need a second request to render one of four states.
   */
  const phone = ref<PhoneState | null>(null)

  /** Balance summary, so the profile card needs no wallet request. */
  const wallet = ref<WalletSummary | null>(null)

  /**
   * How the account is secured, fetched on demand by the settings screen.
   *
   * Not folded into /me: it is only needed on one screen, and "does this
   * account have a password" is a question a boot request should not be
   * answering for every user on every page load.
   */
  const security = ref<SecurityOverview | null>(null)
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

  /**
   * Counts the navigation badges read, delivered with `/me`.
   *
   * Here rather than in an activities store because the badge is rendered by
   * the shell on every screen, long before anything to do with activities is
   * loaded — and because `/me` is already fetched on boot, so the badge is
   * correct on the first paint instead of after a second request.
   */
  const counters = ref<UserCounters | null>(null)
  let inFlight: Promise<unknown> | null = null

  const isAuthenticated = computed(() => !!token.value)
  const isIdentityVerified = computed(() => user.value?.verification_status === 'verified')

  /**
   * Whether the account can create or join activities.
   *
   * A verified number is still the trust gate for those — it just is not asked
   * for during onboarding any more. The screens that need it read this rather
   * than each deciding what "has a phone" means.
   */
  const isPhoneVerified = computed(() => phone.value?.verified ?? false)

  function setSession(newUser: User, newToken: string) {
    user.value = newUser
    token.value = newToken
    localStorage.setItem('rivex_token', newToken)
  }

  function clearSession() {
    user.value = null
    token.value = null
    phone.value = null
    wallet.value = null
    security.value = null
    onboarding.value = null
    completion.value = null
    usernamePolicy.value = null
    followCounts.value = null
    counters.value = null
    inFlight = null
    localStorage.removeItem('rivex_token')
    sessionStorage.removeItem(GOOGLE_STATE_KEY)
    useNotificationsStore().reset()
    // Follow relationships are answers about ONE viewer. Carrying them into the
    // next session would show the previous account's follow states to whoever
    // signs in next — wrong, and a small privacy leak.
    useFollowStore().reset()
    disconnectEcho()
  }

  /**
   * Step 1 of signing in: ask the server for a consent URL and remember the
   * state it minted.
   *
   * The state is stored before navigating, because the callback runs in a
   * fresh page and has nothing else to prove the request started here.
   */
  async function beginGoogleSignIn(redirectUri: string) {
    const { data } = await authApi.googleRedirect(redirectUri)

    sessionStorage.setItem(GOOGLE_STATE_KEY, data.data.state)

    return data.data
  }

  /**
   * Step 2: redeem the code Google sent the browser back with.
   *
   * The state comes from sessionStorage rather than the URL: the whole point
   * of the parameter is that the value in the URL has to MATCH one this client
   * issued, and sending back whatever arrived would defeat it. The server
   * checks its own copy too — this is the client half of the same guard.
   */
  async function completeGoogleSignIn(params: { code?: string; error?: string; state?: string }) {
    const expected = sessionStorage.getItem(GOOGLE_STATE_KEY)
    sessionStorage.removeItem(GOOGLE_STATE_KEY)

    if (params.error) {
      // A cancelled consent screen is a decision, not a failure to retry.
      return authApi.googleCallback({ error: params.error }).then(
        () => null,
        (e) => Promise.reject(e),
      )
    }

    if (!expected || !params.state || params.state !== expected) {
      throw new Error("Kirish sessiyasi eskirgan. Qaytadan urinib ko'ring.")
    }

    const { data } = await authApi.googleCallback({ code: params.code, state: expected })

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

  /**
   * A Google-only account has no password to re-prove, so it confirms deletion
   * by typing its handle back. The caller passes whichever proof applies; the
   * server decides which one it needs.
   */
  async function deleteAccount(proof: { password?: string; confirmation?: string }) {
    await authApi.deleteAccount(proof)
    clearSession()
  }

  async function fetchMe() {
    const { data } = await authApi.me()
    user.value = data.data
    phone.value = data.phone ?? null
    wallet.value = data.wallet ?? null
    onboarding.value = data.onboarding ?? null
    completion.value = data.completion ?? null
    usernamePolicy.value = data.username_policy ?? null
    followCounts.value = data.follow_counts ?? null
    counters.value = data.counters ?? null
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

  /** Keeps the profile's phone row current without re-fetching all of /me. */
  function setPhoneState(next: PhoneState) {
    phone.value = next

    if (onboarding.value) {
      onboarding.value.phone_status = next.status
      onboarding.value.phone_verified = next.verified
    }

    if (user.value) {
      user.value.phone = next.phone ?? undefined
      user.value.phone_verified = next.verified
    }
  }

  async function requestPhoneVerification(value: string) {
    const { data } = await phoneApi.request(value)
    setPhoneState(data.data)

    return data
  }

  async function confirmPhoneVerification(code: string) {
    const { data } = await phoneApi.confirm(code)
    setPhoneState(data.data)

    // The badge on the profile and the trust gates both read /me, so it is
    // refreshed once the number is proved rather than patched in two places.
    //
    // Best-effort on purpose: the number IS verified at this point — the
    // server said so and `setPhoneState` has already applied it. A failed
    // refresh must not turn a success the user just completed into an error
    // message, which is exactly what awaiting it unguarded did.
    await fetchMe().catch(() => undefined)

    return data
  }

  async function resendPhoneCode() {
    const { data } = await phoneApi.resend()
    setPhoneState(data.data)

    return data
  }

  async function cancelPhoneVerification() {
    const { data } = await phoneApi.cancelPending()
    setPhoneState(data.data)
  }

  async function removePhone() {
    const { data } = await phoneApi.remove()
    setPhoneState(data.data)
  }

  async function fetchSecurity() {
    const { data } = await authApi.security()
    security.value = data.data

    return data.data
  }

  /** Applied after a wallet movement so the profile card does not go stale. */
  function setWalletSummary(next: Partial<WalletSummary>) {
    if (wallet.value) wallet.value = { ...wallet.value, ...next }
  }

  return {
    user,
    token,
    phone,
    wallet,
    security,
    onboarding,
    counters,
    completion,
    usernamePolicy,
    followCounts,
    isAuthenticated,
    isIdentityVerified,
    isPhoneVerified,
    ensureLoaded,
    beginGoogleSignIn,
    completeGoogleSignIn,
    logout,
    deleteAccount,
    fetchMe,
    fetchSecurity,
    requestPhoneVerification,
    confirmPhoneVerification,
    resendPhoneCode,
    cancelPhoneVerification,
    removePhone,
    setPhoneState,
    setWalletSummary,
    setSession,
    clearSession,
  }
}, {
  persist: {
    key: 'rivex-auth',
    pick: ['user'],
  },
})
