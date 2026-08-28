import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const googleRedirect = vi.fn()
const googleCallback = vi.fn()
const me = vi.fn()
const logout = vi.fn()

vi.mock('@/api/auth', () => ({
  authApi: {
    googleRedirect: (...args: unknown[]) => googleRedirect(...args),
    googleCallback: (...args: unknown[]) => googleCallback(...args),
    me: () => me(),
    logout: () => logout(),
    security: vi.fn(),
    deleteAccount: vi.fn(),
    logoutAll: vi.fn(),
    googleStatus: vi.fn(),
    googleLink: vi.fn(),
    changePassword: vi.fn(),
  },
  phoneApi: {
    show: vi.fn(),
    request: vi.fn(),
    confirm: vi.fn(),
    resend: vi.fn(),
    cancelPending: vi.fn(),
    remove: vi.fn(),
  },
}))

// The notifications store is reset on sign-out and subscribes to Echo when it
// is created, which needs a live socket this test has no use for.
vi.mock('@/composables/useEcho', () => ({
  disconnectEcho: vi.fn(),
  onEchoReconnect: vi.fn(),
  getEcho: vi.fn(() => null),
}))

const { useAuthStore } = await import('@/stores/auth')

const USER = { id: 7, name: 'Aziz', display_name: 'Aziz' }

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  sessionStorage.clear()
  vi.clearAllMocks()
})

describe('Google sign-in', () => {
  it('stores the state before leaving for Google', async () => {
    googleRedirect.mockResolvedValue({
      data: { data: { url: 'https://accounts.google.com/x', state: 'st-1', expires_in: 600 } },
    })

    const auth = useAuthStore()
    const result = await auth.beginGoogleSignIn('http://localhost/auth/google/callback')

    expect(result.url).toContain('accounts.google.com')

    // The round trip is a full page load, so the state cannot live in memory.
    expect(sessionStorage.getItem('rivex_google_state')).toBe('st-1')
  })

  it('completes the sign-in and keeps the token', async () => {
    sessionStorage.setItem('rivex_google_state', 'st-1')
    googleCallback.mockResolvedValue({
      data: { user: USER, token: 'tok-1', is_new_user: true },
    })

    const auth = useAuthStore()
    const result = await auth.completeGoogleSignIn({ code: 'fake:x', state: 'st-1' })

    expect(result?.is_new_user).toBe(true)
    expect(auth.isAuthenticated).toBe(true)
    expect(localStorage.getItem('rivex_token')).toBe('tok-1')

    // Single use: the state is spent whether or not the exchange succeeded.
    expect(sessionStorage.getItem('rivex_google_state')).toBeNull()
  })

  /**
   * The client half of the OAuth CSRF guard.
   *
   * A `state` this client did not issue must never be forwarded — that is the
   * whole point of the parameter, and sending back whatever arrived in the URL
   * would defeat it. The server checks its own copy too; this is the first line.
   */
  it('refuses a state it did not issue', async () => {
    sessionStorage.setItem('rivex_google_state', 'mine')

    const auth = useAuthStore()

    await expect(
      auth.completeGoogleSignIn({ code: 'fake:x', state: 'someone-elses' }),
    ).rejects.toThrow()

    expect(googleCallback).not.toHaveBeenCalled()
    expect(auth.isAuthenticated).toBe(false)
  })

  it('refuses a callback with no stored state at all', async () => {
    const auth = useAuthStore()

    await expect(auth.completeGoogleSignIn({ code: 'fake:x', state: 'st-1' })).rejects.toThrow()

    expect(googleCallback).not.toHaveBeenCalled()
  })

  it('reports a cancelled consent screen without creating a session', async () => {
    googleCallback.mockResolvedValue({ data: {} })

    const auth = useAuthStore()
    const result = await auth.completeGoogleSignIn({ error: 'access_denied' })

    expect(result).toBeNull()
    expect(auth.isAuthenticated).toBe(false)
  })

  it('clears every trace of the session on sign-out', async () => {
    sessionStorage.setItem('rivex_google_state', 'st-1')
    googleCallback.mockResolvedValue({ data: { user: USER, token: 'tok', is_new_user: false } })

    const auth = useAuthStore()
    sessionStorage.setItem('rivex_google_state', 'st-1')
    await auth.completeGoogleSignIn({ code: 'c', state: 'st-1' })

    await auth.logout()

    expect(auth.user).toBeNull()
    expect(auth.phone).toBeNull()
    expect(auth.wallet).toBeNull()
    expect(localStorage.getItem('rivex_token')).toBeNull()
    expect(sessionStorage.getItem('rivex_google_state')).toBeNull()
  })
})

describe('phone state', () => {
  it('is loaded from /me and drives the verified flag', async () => {
    me.mockResolvedValue({
      data: {
        data: USER,
        onboarding: {
          google_linked: true,
          location_selected: true,
          username_set: true,
          phone_status: 'verified',
          phone_verified: true,
          identity_status: 'verified',
          completed: true,
        },
        phone: {
          status: 'verified',
          phone: '+998901234567',
          pending_phone: null,
          verified: true,
        },
        wallet: { balance_minor: 150000, balance: 150000, currency: 'UZS', test_mode: true },
        completion: null,
        username_policy: null,
        follow_counts: null,
        counters: null,
      },
    })

    const auth = useAuthStore()
    await auth.fetchMe()

    expect(auth.isPhoneVerified).toBe(true)
    expect(auth.wallet?.test_mode).toBe(true)
    expect(auth.wallet?.balance_minor).toBe(150000)
  })

  it('treats a missing phone as unverified rather than throwing', () => {
    expect(useAuthStore().isPhoneVerified).toBe(false)
  })
})
