import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api/auth'
import { useNotificationsStore } from '@/stores/notifications'
import { disconnectEcho } from '@/composables/useEcho'
import type { User } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(localStorage.getItem('rivex_token'))
  const pendingPhone = ref<string | null>(null)

  const isAuthenticated = computed(() => !!token.value)

  function setSession(newUser: User, newToken: string) {
    user.value = newUser
    token.value = newToken
    localStorage.setItem('rivex_token', newToken)
  }

  function clearSession() {
    user.value = null
    token.value = null
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
    return data.data
  }

  async function verifyPhone(code: string) {
    if (!pendingPhone.value && user.value) pendingPhone.value = user.value.phone
    if (!pendingPhone.value) throw new Error('No phone pending verification')
    await authApi.verifyPhone({ phone: pendingPhone.value, code })
    await fetchMe()
  }

  async function resendOtp() {
    if (!pendingPhone.value && user.value) pendingPhone.value = user.value.phone
    if (!pendingPhone.value) throw new Error('No phone pending verification')
    return authApi.resendOtp({ phone: pendingPhone.value })
  }

  return {
    user,
    token,
    isAuthenticated,
    pendingPhone,
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
