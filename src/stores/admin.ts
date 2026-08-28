import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { adminAuthApi } from '@/api/admin'
import type { AdminUser } from '@/types'

/** Namespaced apart from the consumer flow's state — see beginGoogleSignIn. */
const ADMIN_GOOGLE_STATE_KEY = 'rivex_admin_google_state'

/** Read by GoogleCallbackView to decide which sign-in it is completing. */
export const GOOGLE_FLOW_KEY = 'rivex_google_flow'

export const useAdminStore = defineStore('admin', () => {
  const admin = ref<AdminUser | null>(null)
  const token = ref<string | null>(localStorage.getItem('rivex_admin_token'))

  const isAuthenticated = computed(() => !!token.value)

  /**
   * Whether the signed-in admin holds a permission.
   *
   * Used to decide what to render. It is NOT access control: every admin
   * endpoint is gated server-side by `admin.can`, and hiding a menu entry only
   * spares someone a 403 they would otherwise walk into.
   */
  function can(permission: string): boolean {
    return admin.value?.permissions?.includes(permission) ?? false
  }

  async function login(payload: { email: string; password: string }) {
    const { data } = await adminAuthApi.login(payload)
    setSession(data.admin, data.token)
    return data
  }

  function setSession(value: AdminUser, issued: string) {
    admin.value = value
    token.value = issued
    localStorage.setItem('rivex_admin_token', issued)
  }

  /**
   * Step 1 of Google sign-in: get a consent URL and remember the state.
   *
   * The state is stored under its own key, never the consumer flow's. They are
   * different single-use values redeemed at different endpoints, and one
   * overwriting the other would silently break whichever sign-in started first
   * — which is a real sequence, because an admin is usually also a user.
   */
  async function beginGoogleSignIn(redirectUri: string) {
    const { data } = await adminAuthApi.googleRedirect(redirectUri)

    sessionStorage.setItem(ADMIN_GOOGLE_STATE_KEY, data.data.state)
    // Which flow the callback page is completing. Both flows come back to the
    // same redirect URI so only one has to be registered in Google Cloud
    // Console; this is what tells the callback which backend to redeem at.
    sessionStorage.setItem(GOOGLE_FLOW_KEY, 'admin')

    return data.data
  }

  /** Step 2: redeem the code, exactly as the consumer store does. */
  async function completeGoogleSignIn(params: { code?: string; state?: string }) {
    const expected = sessionStorage.getItem(ADMIN_GOOGLE_STATE_KEY)
    sessionStorage.removeItem(ADMIN_GOOGLE_STATE_KEY)
    sessionStorage.removeItem(GOOGLE_FLOW_KEY)

    // The value in the URL has to MATCH one this client issued; echoing back
    // whatever arrived would defeat the entire point of the parameter. The
    // server checks its own copy too — this is the client half of that guard.
    if (!expected || !params.state || params.state !== expected) {
      throw new Error("Kirish sessiyasi eskirgan. Qaytadan urinib ko'ring.")
    }

    const { data } = await adminAuthApi.googleCallback({ code: params.code, state: expected })

    setSession(data.admin, data.token)

    return data
  }

  /**
   * Refresh identity and permissions once per session.
   *
   * The store persists `admin` so the panel renders instantly on reload, but a
   * role changed since the last login would otherwise keep showing the old
   * menu until logout. Failure is silent: the adminClient 401 interceptor
   * already handles a genuinely dead session, and a network blip must not lock
   * an admin out of a panel whose data all comes from the server anyway.
   */
  let inFlight: Promise<unknown> | null = null

  function ensureLoaded() {
    if (!token.value) return Promise.resolve()
    if (admin.value?.permissions) return Promise.resolve()

    inFlight ??= adminAuthApi
      .me()
      .then(({ data }) => {
        admin.value = data.admin
      })
      .catch(() => undefined)
      .finally(() => {
        inFlight = null
      })

    return inFlight
  }

  async function logout() {
    try {
      await adminAuthApi.logout()
    } finally {
      admin.value = null
      token.value = null
      inFlight = null
      localStorage.removeItem('rivex_admin_token')
      sessionStorage.removeItem(ADMIN_GOOGLE_STATE_KEY)
    }
  }

  return {
    admin,
    token,
    isAuthenticated,
    can,
    ensureLoaded,
    login,
    beginGoogleSignIn,
    completeGoogleSignIn,
    logout,
  }
}, {
  persist: {
    key: 'rivex-admin-auth',
    pick: ['admin'],
  },
})
