import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import router from '@/router'

/**
 * Where a handle may be changed, and where it may not.
 *
 * The handle used to be a card inside "Edit Profile", reached by tapping your
 * own `@name` on the profile page. Two things were wrong with that and both are
 * pinned here, because both are the kind of thing a later refactor restores by
 * accident:
 *
 *   - the profile page must not link its `@name` to an editor — an identity is
 *     not a control;
 *   - the editor lives at exactly one route under Account, not as an anchor
 *     into the middle of a different screen.
 */
function source(path: string): string {
  return readFileSync(resolve(__dirname, '../../..', path), 'utf8')
}

describe('account settings routes', () => {
  it('has a route for the account group', () => {
    const route = router.getRoutes().find((r) => r.name === 'account-settings')

    expect(route?.path).toBe('/settings/account')
    expect(route?.meta.requiresAuth).toBe(true)
  })

  it('has exactly one route that edits a username', () => {
    const route = router.getRoutes().find((r) => r.name === 'username-settings')

    expect(route?.path).toBe('/settings/account/username')
    expect(route?.meta.requiresAuth).toBe(true)
  })

  /**
   * One settings route touches the handle.
   *
   * `/auth/username` is deliberately not counted: picking a handle during
   * signup has no cooldown and no released-handle quarantine, so it is a
   * different flow rather than a second copy of this one — and it shares the
   * shape rules through `useUsernameCheck` rather than duplicating them.
   * `/u/:username` is a public profile and edits nothing.
   */
  it('routes no other settings screen at a username', () => {
    const settingsUsernameRoutes = router
      .getRoutes()
      .map((r) => r.path)
      .filter((path) => path.startsWith('/settings') && path.includes('username'))

    expect(settingsUsernameRoutes).toEqual(['/settings/account/username'])
  })

  it('does not route the profile editor at a username any more', () => {
    const editor = router.getRoutes().find((r) => r.name === 'profile-edit')

    expect(editor?.path).toBe('/profile/edit')
    expect(editor?.path).not.toContain('username')
  })
})

describe('username editor placement', () => {
  /** Moved, not duplicated — one component, one mount point. */
  it('is mounted by the username settings screen', () => {
    expect(source('views/settings/UsernameView.vue')).toContain('UsernameEditor')
  })

  it('is not mounted by the profile editor any more', () => {
    expect(source('views/profile/ProfileEditView.vue')).not.toContain('UsernameEditor')
  })

  it('is mounted in exactly one place in the app', () => {
    const mounts = ['views/settings/UsernameView.vue', 'views/profile/ProfileEditView.vue']
      .map(source)
      .filter((file) => file.includes('<UsernameEditor'))

    expect(mounts).toHaveLength(1)
  })

  /**
   * The profile page shows the handle as text. It was a RouterLink into the
   * edit screen, which is what made the handle look like the thing you tap to
   * rename yourself.
   */
  it('is not reachable by tapping the handle on the profile page', () => {
    const view = source('views/profile/ProfileView.vue')
    const handleLine = view.split('\n').find((line) => line.includes('@{{ auth.user.username }}'))

    expect(handleLine).toBeDefined()
    expect(handleLine).not.toContain('RouterLink')
    expect(handleLine).toContain('<p')
  })
})
