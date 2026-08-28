import type { Page, BrowserContext, Browser } from '@playwright/test'

/**
 * Mirrors Database\Seeders\E2eSeeder.
 *
 * `code` is what the fake Google provider maps to each account — the seeder
 * and this file have to agree on it, because that string IS the identity.
 * See App\Auth\Google\Providers\FakeGoogleProvider for the format.
 */
export const USERS = {
  a: {
    name: 'E2E Aziz',
    phone: '+998900000001',
    email: 'e2e-aziz@example.test',
    code: 'fake:e2e-aziz:e2e-aziz@example.test:E2E Aziz',
  },
  b: {
    name: 'E2E Bekzod',
    phone: '+998900000002',
    email: 'e2e-bekzod@example.test',
    code: 'fake:e2e-bekzod:e2e-bekzod@example.test:E2E Bekzod',
  },
} as const

export const ADMIN = {
  superAdmin: { email: 'admin@rivex.local', password: 'password' },
  finance: { email: 'finance@rivex.local', password: 'password' },
} as const

export const API = 'http://127.0.0.1:8812/api/v1'

/**
 * Sign in through the real Google flow, against the FAKE provider.
 *
 * The E2E environment sets GOOGLE_OAUTH_FAKE=true, so the backend swaps
 * Google's OIDC client for a deterministic stand-in: no credentials, no
 * network, no consent screen — but the same two endpoints, the same
 * single-use `state`, and the same account resolution. The suite therefore
 * never depends on real Google credentials, which is the whole point.
 *
 * The state is minted through /auth/google/redirect rather than invented,
 * because the CSRF guard is half of what makes this flow safe and a fixture
 * that skipped it would let the suite pass with the guard broken.
 */
export async function loginAs(page: Page, code: string) {
  await page.goto('/auth/login')

  const token = await page.evaluate(
    async ([api, oauthCode]) => {
      const begin = await fetch(`${api}/auth/google/redirect`, {
        headers: { Accept: 'application/json' },
      })

      if (!begin.ok) throw new Error(`google redirect failed: ${begin.status}`)

      const { data } = await begin.json()

      const response = await fetch(`${api}/auth/google/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ code: oauthCode, state: data.state }),
      })

      if (!response.ok) throw new Error(`google callback failed: ${response.status}`)

      const session = await response.json()
      localStorage.setItem('rivex_token', session.token)

      return session.token as string
    },
    [API, code] as const,
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
