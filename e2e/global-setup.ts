import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

const BACKEND = resolve(process.cwd(), '../rivex-back')

/**
 * Reset the E2E database before the run.
 *
 * `migrate:fresh` is destructive by design, which is exactly why it is pinned
 * to `rivex_e2e` here and never reads the developer's own DB_DATABASE.
 */
export default function globalSetup() {
  const env = { ...process.env, DB_DATABASE: 'rivex_e2e', APP_ENV: 'local' }

  const artisan = (args: string[]) =>
    execFileSync('php', ['artisan', ...args], { cwd: BACKEND, env, stdio: 'inherit' })

  artisan(['migrate:fresh', '--seed', '--force'])
  artisan(['db:seed', '--class=E2eSeeder', '--force'])
}
