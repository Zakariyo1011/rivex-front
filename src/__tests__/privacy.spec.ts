import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * The frontend half of the P0 phone-number fix.
 *
 * The backend now withholds `phone` from everyone but its owner and admins, and
 * a Laravel test locks that down. This guards the other direction: that no
 * screen starts reading a phone number off an *embedded* user again — an
 * activity organiser, a message sender, the two sides of a no-show report.
 * Such a component would render nothing today, and would quietly start leaking
 * the moment someone "helpfully" restored the field on the server.
 *
 * Reading `auth.user.phone` (your own number) and the admin panel are the two
 * legitimate cases, so they are named here rather than blanket-allowed.
 *
 * The list changed when Google took over sign-in: the number moved out of the
 * auth screens and onto the profile, so `VerifyPhoneView` and
 * `ChangePhoneModal` are gone and `PhoneNumberCard` — the one component that
 * now owns the number — took their place. The rule itself is unchanged.
 */

// Resolved from the project root: under jsdom `import.meta.url` is not a
// file URL, so it cannot be used to locate the sources.
const SRC = join(process.cwd(), 'src')

/** Places a phone number is genuinely the subject of the screen. */
const ALLOWED = new Set([
  'stores/auth.ts',
  'api/auth.ts',

  // The one component that renders, adds and verifies the owner's own number.
  'components/profile/PhoneNumberCard.vue',
  'views/settings/PhoneView.vue',

  'views/settings/SettingsView.vue',
  'views/profile/ProfileView.vue',
  'views/admin/UsersView.vue',
])

/**
 * Application sources only.
 *
 * Test files are excluded rather than allow-listed one by one: a spec asserting
 * ON this rule necessarily mentions the field, and adding each new one to the
 * allowlist would slowly turn the allowlist into the thing that needs guarding.
 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)

    if (statSync(full).isDirectory()) {
      return entry === '__tests__' ? [] : sourceFiles(full)
    }

    return /\.(ts|vue)$/.test(entry) && !/\.spec\.(ts|vue)$/.test(entry) ? [full] : []
  })
}

/**
 * `.phone` on a user object.
 *
 * Excludes `.phone_verified` (a public boolean badge, not the number) and
 * `icons.phone` (the glyph on the "verify your phone" prompts).
 */
const PHONE_ACCESS = /(?<!icons)\.phone\b(?!_verified)/

describe('phone numbers in the client', () => {
  it('is only read where the number belongs to the viewer or an admin', () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => PHONE_ACCESS.test(readFileSync(file, 'utf8')))
      .map((file) => relative(SRC, file).replaceAll('\\', '/'))
      .filter((file) => !ALLOWED.has(file))

    expect(offenders, `Unexpected phone access in: ${offenders.join(', ')}`).toEqual([])
  })

  it('models phone as optional, so a missing number is a type error to ignore', () => {
    const types = readFileSync(join(SRC, 'types/index.ts'), 'utf8')

    expect(types).toMatch(/phone\?: string/)
  })
})
