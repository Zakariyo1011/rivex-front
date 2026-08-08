import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { adminAuthApi } from '@/api/admin'
import type { AdminUser } from '@/types'

export const useAdminStore = defineStore('admin', () => {
  const admin = ref<AdminUser | null>(null)
  const token = ref<string | null>(localStorage.getItem('rivex_admin_token'))

  const isAuthenticated = computed(() => !!token.value)

  async function login(payload: { email: string; password: string }) {
    const { data } = await adminAuthApi.login(payload)
    admin.value = data.admin
    token.value = data.token
    localStorage.setItem('rivex_admin_token', data.token)
    return data
  }

  async function logout() {
    try {
      await adminAuthApi.logout()
    } finally {
      admin.value = null
      token.value = null
      localStorage.removeItem('rivex_admin_token')
    }
  }

  return { admin, token, isAuthenticated, login, logout }
}, {
  persist: {
    key: 'rivex-admin-auth',
    pick: ['admin'],
  },
})
