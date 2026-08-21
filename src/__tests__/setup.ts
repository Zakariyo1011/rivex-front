import { vi } from 'vitest'

/**
 * Environment the app expects at import time.
 *
 * `useEcho` reads VITE_API_URL while building the auth endpoint, so it has to
 * exist before any module that imports it is evaluated.
 */
Object.assign(import.meta.env, {
  VITE_API_URL: 'http://localhost/api/v1',
  VITE_REVERB_APP_KEY: 'test-key',
  VITE_REVERB_HOST: 'localhost',
  VITE_REVERB_PORT: '8080',
  VITE_REVERB_SCHEME: 'http',
})

// jsdom has no IntersectionObserver, which the notification centre uses for
// infinite scroll.
class NoopIntersectionObserver implements IntersectionObserver {
  readonly root = null
  readonly rootMargin = ''
  readonly thresholds: readonly number[] = []
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  takeRecords = vi.fn(() => [])
}

vi.stubGlobal('IntersectionObserver', NoopIntersectionObserver)

// jsdom implements neither of these, and both are ordinary in a real browser.
// Stubbed here rather than guarded at each call site: a `typeof x === 'function'`
// check in a component is a test-environment detail leaking into product code.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}
