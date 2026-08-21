import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

/**
 * Reset the E2E database — **before** Playwright starts anything.
 *
 * This used to live in `globalSetup`, and that is the bug it fixes. Playwright
 * starts `webServer` processes first and runs `globalSetup` second, so
 * `migrate:fresh` was dropping every table while Reverb was already running —
 * including `cache`, which is where `CACHE_STORE=database` puts
 * `laravel:reverb:restart`. Reverb polls that key (see Laravel\Reverb
 * StartServer::restartSignalReceived), so the poll landed on a table that did
 * not exist for the moment between DROP and CREATE and the server died. Every
 * test after the first that needed a broadcast then failed with
 * "cURL error 7: connection refused" — which reads like a broken application
 * and is not one.
 *
 * As a `pretest:e2e` script it runs to completion before any server exists,
 * which is the ordering the reset actually needs.
 */
const BACKEND = resolve(import.meta.dirname, '../../rivex-back')
const env = { ...process.env, DB_DATABASE: 'rivex_e2e', APP_ENV: 'local' }

const artisan = (args) =>
  execFileSync('php', ['artisan', ...args], { cwd: BACKEND, env, stdio: 'inherit' })

artisan(['migrate:fresh', '--seed', '--force'])
artisan(['db:seed', '--class=E2eSeeder', '--force'])
