import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const login = vi.fn()
const logout = vi.fn()
const me = vi.fn()

vi.mock('@/api/admin', () => ({
  adminAuthApi: {
    login: (...args: unknown[]) => login(...args),
    logout: () => logout(),
    me: () => me(),
  },
}))

const { useAdminStore } = await import('@/stores/admin')

function admin(role: string, permissions: string[]) {
  return {
    admin: { id: 1, name: 'A', email: 'a@rivex.uz', role, role_label: role, permissions },
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  vi.clearAllMocks()
})

describe('admin permissions', () => {
  it('reports no permissions before sign-in', () => {
    expect(useAdminStore().can('withdrawals.view')).toBe(false)
  })

  it('takes the permission set from the login response', async () => {
    login.mockResolvedValue({
      data: { ...admin('moderator', ['users.view', 'reports.resolve']), token: 't' },
    })

    const store = useAdminStore()
    await store.login({ email: 'a@rivex.uz', password: 'x' })

    expect(store.can('reports.resolve')).toBe(true)
    expect(store.can('withdrawals.decide')).toBe(false)
    expect(store.can('audit-logs.view')).toBe(false)
  })

  /**
   * A role changed server-side must not keep showing the old menu just because
   * the previous permission set was persisted to localStorage.
   */
  it('refreshes permissions from the server when they are missing', async () => {
    localStorage.setItem('rivex_admin_token', 'existing-token')
    me.mockResolvedValue({ data: admin('finance', ['withdrawals.view', 'withdrawals.decide']) })

    const store = useAdminStore()
    await store.ensureLoaded()

    expect(me).toHaveBeenCalledTimes(1)
    expect(store.can('withdrawals.decide')).toBe(true)
  })

  it('does not re-fetch when permissions are already known', async () => {
    localStorage.setItem('rivex_admin_token', 'existing-token')
    me.mockResolvedValue({ data: admin('support', ['users.view']) })

    const store = useAdminStore()
    await store.ensureLoaded()
    await store.ensureLoaded()

    expect(me).toHaveBeenCalledTimes(1)
  })

  it('does not call the server when signed out', async () => {
    await useAdminStore().ensureLoaded()

    expect(me).not.toHaveBeenCalled()
  })

  /** A blip must not lock an admin out of a panel that will 401 properly anyway. */
  it('stays usable when the refresh fails', async () => {
    localStorage.setItem('rivex_admin_token', 'existing-token')
    me.mockRejectedValue(new Error('offline'))

    const store = useAdminStore()
    await expect(store.ensureLoaded()).resolves.toBeUndefined()
    expect(store.can('users.view')).toBe(false)
  })

  it('forgets the permission set on logout', async () => {
    login.mockResolvedValue({ data: { ...admin('super_admin', ['audit-logs.view']), token: 't' } })
    logout.mockResolvedValue({})

    const store = useAdminStore()
    await store.login({ email: 'a@rivex.uz', password: 'x' })
    expect(store.can('audit-logs.view')).toBe(true)

    await store.logout()

    expect(store.can('audit-logs.view')).toBe(false)
    expect(localStorage.getItem('rivex_admin_token')).toBeNull()
  })

  /** An entry the client has never heard of stays hidden rather than shown. */
  it('treats an unknown permission as denied', async () => {
    login.mockResolvedValue({ data: { ...admin('support', ['users.view']), token: 't' } })

    const store = useAdminStore()
    await store.login({ email: 'a@rivex.uz', password: 'x' })

    expect(store.can('something.invented.later')).toBe(false)
  })
})
