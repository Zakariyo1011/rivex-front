import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * Every route name the app pushes to has to exist.
 *
 * This test exists because of a real bug: when Google took over sign-in, the
 * `verify-phone` onboarding step was deleted — but two places still pushed to
 * it by name (`useVerificationGuard`, `VerificationBanner`). Vue Router does
 * not fail a build over an unknown name; it fails at the moment a user is
 * refused an action, which is the exact moment the redirect was there to
 * rescue. TypeScript cannot catch it either, because a route name is a string.
 *
 * So the names are collected from the router and every `name: '...'` inside a
 * router target elsewhere is checked against them.
 */
const SRC = join(process.cwd(), 'src')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)

    if (statSync(full).isDirectory()) {
      return entry === '__tests__' ? [] : sourceFiles(full)
    }

    return /\.(ts|vue)$/.test(entry) && !/\.spec\.(ts|vue)$/.test(entry) ? [full] : []
  })
}

/** The `name:` of every route defined in the router. */
function definedRouteNames(): Set<string> {
  const router = readFileSync(join(SRC, 'router/index.ts'), 'utf8')

  return new Set([...router.matchAll(/^\s*name: '([^']+)',$/gm)].map((m) => m[1] as string))
}

/**
 * Route names referenced from a navigation target.
 *
 * Matches `{ name: 'x' }` shapes only — `:to`, `router.push`, `router.replace`
 * — which is where an unknown name actually breaks. Deliberately narrow: a
 * broad scan would pick up every object with a `name` key in the codebase.
 */
function referencedRouteNames(file: string): string[] {
  const source = readFileSync(file, 'utf8')

  return [...source.matchAll(/\{\s*name:\s*'([a-z][a-z0-9-]*)'\s*[,}]/g)].map(
    (m) => m[1] as string,
  )
}

describe('router targets', () => {
  it('never navigates to a route that does not exist', () => {
    const defined = definedRouteNames()

    expect(defined.size, 'no routes were parsed — the regex is stale').toBeGreaterThan(10)

    const dangling = sourceFiles(SRC)
      .filter((file) => !file.endsWith(join('router', 'index.ts')))
      .flatMap((file) =>
        referencedRouteNames(file)
          .filter((name) => !defined.has(name))
          .map((name) => `${relative(SRC, file).replaceAll('\\', '/')} → '${name}'`),
      )

    expect(dangling, `Unknown route name(s):\n  ${dangling.join('\n  ')}`).toEqual([])
  })

  it('still defines the routes the phone and wallet flows depend on', () => {
    const defined = definedRouteNames()

    for (const name of [
      'welcome',
      'login',
      'google-callback',
      'onboarding-location',
      'onboarding-username',
      'phone-settings',
      'wallet',
      'verification-intro',
      'admin-wallets',
      'admin-transactions',
    ]) {
      expect(defined.has(name), `route '${name}' is missing`).toBe(true)
    }
  })

  /** The auth screens Google replaced must not come back by accident. */
  it('no longer defines the phone-credential routes', () => {
    const defined = definedRouteNames()

    expect(defined.has('register')).toBe(false)
    expect(defined.has('verify-phone')).toBe(false)
  })
})
