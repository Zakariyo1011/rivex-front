import { describe, it, expect, beforeEach } from 'vitest'
import type { InternalAxiosRequestConfig } from 'axios'
import client from '@/api/client'

/**
 * The request interceptor is what makes Echo's authorizer safe.
 *
 * `useEcho` no longer captures a token at module-evaluation time; it posts
 * through this client instead, so the token has to be read on every request or
 * the original bug is simply relocated.
 */
function runRequestInterceptor(config: Partial<InternalAxiosRequestConfig> = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handler = (client.interceptors.request as any).handlers[0].fulfilled

  return handler({ headers: {}, ...config }) as InternalAxiosRequestConfig
}

beforeEach(() => localStorage.clear())

describe('api client auth header', () => {
  it('attaches the token that exists at request time', () => {
    localStorage.setItem('rivex_token', 'token-one')

    expect(runRequestInterceptor().headers.Authorization).toBe('Bearer token-one')
  })

  /**
   * The regression in one assertion: a token written *after* the module was
   * first imported still has to be used.
   */
  it('picks up a token issued after the module was loaded', () => {
    expect(runRequestInterceptor().headers.Authorization).toBeUndefined()

    localStorage.setItem('rivex_token', 'token-after-login')

    expect(runRequestInterceptor().headers.Authorization).toBe('Bearer token-after-login')
  })

  it('uses the newest token after a re-login', () => {
    localStorage.setItem('rivex_token', 'old')
    runRequestInterceptor()

    localStorage.setItem('rivex_token', 'new')

    expect(runRequestInterceptor().headers.Authorization).toBe('Bearer new')
  })

  it('sends no auth header when signed out', () => {
    expect(runRequestInterceptor().headers.Authorization).toBeUndefined()
  })
})
