import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

/**
 * Separate from vite.config.ts on purpose: the dev-tools and Tailwind plugins
 * are pure overhead in a headless test run, and vueDevTools in particular
 * injects a client script that has nothing to attach to.
 */
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    // Playwright owns `e2e/`; without this Vitest would try to run those
    // specs and fail on the missing @playwright/test runtime.
    include: ['src/**/*.spec.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
    setupFiles: ['./src/__tests__/setup.ts'],
  },
})
