import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end configuration for the critical journey.
 *
 * Everything runs against a dedicated `rivex_e2e` database on its own ports, so
 * a test run can never touch the development data someone is working with.
 * Playwright starts all three processes itself — API, Reverb and Vite — because
 * the journey asserts realtime behaviour and a missing WebSocket server would
 * turn a real failure into a mysterious timeout.
 *
 * `channel: 'chrome'` uses the Chrome already installed on the machine:
 * Playwright's own Chromium build is not available for macOS 13, and requiring
 * a browser download that cannot succeed would make the suite unrunnable here.
 */

const API_PORT = 8812
const REVERB_PORT = 8081
const WEB_PORT = 5274

const API_URL = `http://127.0.0.1:${API_PORT}`
// `localhost`, not `127.0.0.1`: Vite binds to the hostname, which resolves
// to ::1 on this machine, so a 127.0.0.1 readiness probe never succeeds and
// Playwright would time out waiting for a server that is actually up.
const BASE_URL = `http://localhost:${WEB_PORT}`

/** Shared by every backend process so they agree on database and ports. */
const backendEnv = {
  APP_ENV: 'local',
  DB_DATABASE: 'rivex_e2e',
  // Inline delivery: notifications must arrive without a queue worker, and the
  // journey asserts they do.
  QUEUE_CONNECTION: 'sync',
  BROADCAST_CONNECTION: 'reverb',
  PAYMENT_PROVIDER: 'mock',
  SMS_PROVIDER: 'log',
  REVERB_HOST: '127.0.0.1',
  REVERB_PORT: String(REVERB_PORT),
  REVERB_SERVER_PORT: String(REVERB_PORT),
  REVERB_SCHEME: 'http',
  FRONTEND_URLS: BASE_URL,
}

export default defineConfig({
  testDir: './e2e',
  // The journey is one long ordered story; running its steps in parallel would
  // be meaningless and the two contexts already exercise concurrency.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],

  globalSetup: './e2e/global-setup.ts',

  use: {
    baseURL: BASE_URL,
    channel: 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [{ name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],

  webServer: [
    {
      command: `php artisan serve --host=127.0.0.1 --port=${API_PORT}`,
      cwd: '../rivex-back',
      url: `${API_URL}/up`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: backendEnv,
    },
    {
      command: `php artisan reverb:start --host=127.0.0.1 --port=${REVERB_PORT}`,
      cwd: '../rivex-back',
      // A WebSocket server, so readiness is "the port accepts connections".
      // Playwright's `url` check wants an HTTP success and Reverb answers 404
      // on /, which it would treat as not-ready until the timeout.
      port: REVERB_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: backendEnv,
    },
    {
      command: `npm run dev -- --port ${WEB_PORT} --strictPort`,
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        VITE_API_URL: `${API_URL}/api/v1`,
        VITE_REVERB_HOST: '127.0.0.1',
        VITE_REVERB_PORT: String(REVERB_PORT),
        VITE_REVERB_SCHEME: 'http',
        VITE_REVERB_APP_KEY: process.env.VITE_REVERB_APP_KEY ?? 'uqeqxe1jon4m1yauix3l',
        VITE_MAP_PROVIDER: 'none',
      },
    },
  ],
})
