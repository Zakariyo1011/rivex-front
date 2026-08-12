import type { Page, BrowserContext, Browser } from '@playwright/test'

/** Mirrors Database\Seeders\E2eSeeder. */
export const USERS = {
  a: { phone: '+998900000001', name: 'E2E Aziz' },
  b: { phone: '+998900000002', name: 'E2E Bekzod' },
} as const

export const PASSWORD = 'Password123!'

export const ADMIN = {
  superAdmin: { email: 'admin@rivex.local', password: 'password' },
  finance: { email: 'finance@rivex.local', password: 'password' },
} as const

export const API = 'http://127.0.0.1:8812/api/v1'

/**
 * Sign in by seeding the token directly.
 *
 * The login form has its own coverage; replaying it at the start of every
 * journey step would add minutes and a second failure mode to a test that is
 * about something else. The token is obtained through the real endpoint, so
 * authentication itself is still exercised.
 */
export async function loginAs(page: Page, phone: string) {
  await page.goto('/auth/login')

  const token = await page.evaluate(
    async ([api, p, password]) => {
      const response = await fetch(`${api}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ phone: p, password }),
      })
      if (!response.ok) throw new Error(`login failed: ${response.status}`)
      const data = await response.json()
      localStorage.setItem('rivex_token', data.token)
      return data.token as string
    },
    [API, phone, PASSWORD] as const,
  )

  return token
}

export async function loginAdmin(page: Page, account: { email: string; password: string }) {
  await page.goto('/admin/login')

  return page.evaluate(
    async ([api, email, password]) => {
      const response = await fetch(`${api}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!response.ok) throw new Error(`admin login failed: ${response.status}`)
      const data = await response.json()
      localStorage.setItem('rivex_admin_token', data.token)
      localStorage.removeItem('rivex-admin-auth')
      return data.token as string
    },
    [API, account.email, account.password] as const,
  )
}

/** A separate browser context per user: separate storage, separate session. */
export async function newUserContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext()
}

/**
 * Call the API as a signed-in user from inside the page.
 *
 * Used for the steps the journey needs to *reach* rather than *prove* — an
 * activity has to exist before anyone can apply to it.
 */
export async function api<T = unknown>(
  page: Page,
  token: string,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  return page.evaluate(
    async ([apiBase, t, p, method, body]) => {
      const response = await fetch(`${apiBase}${p}`, {
        method: method as string,
        headers: {
          Authorization: `Bearer ${t}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      })
      const text = await response.text()
      if (!response.ok) throw new Error(`${method} ${p} -> ${response.status}: ${text}`)
      return text ? JSON.parse(text) : null
    },
    [API, token, path, init.method ?? 'GET', init.body ?? null] as const,
  ) as Promise<T>
}
