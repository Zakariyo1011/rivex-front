import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { adminAuthApi } from '@/api/admin'
import type { AdminUser } from '@/types'

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
    admin.value = data.admin
    token.value = data.token
    localStorage.setItem('rivex_admin_token', data.token)
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
    }
  }

  return { admin, token, isAuthenticated, can, ensureLoaded, login, logout }
}, {
  persist: {
    key: 'rivex-admin-auth',
    pick: ['admin'],
  },
})
