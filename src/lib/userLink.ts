import type { RouteLocationRaw } from 'vue-router'
import type { User } from '@/types'

/**
 * How to address a person, and how to name them. Written once.
 *
 * Both rules were duplicated across the app — the route in six components, the
 * name fallback in five — and duplication of *this* rule is not harmless. An
 * account that has not claimed a handle yet has `username: null`, so a copy
 * that forgets the fallback produces `/u/null`: a link that looks fine in
 * review, works for every seeded user, and 404s for exactly the people who
 * signed up most recently.
 *
 * `/u/{username}` is the canonical profile URL; `/users/{id}` is the legacy
 * route that still resolves and is the only one that works before a handle is
 * chosen.
 */

/** Anything carrying the two fields these helpers need. */
export type Addressable = Pick<User, 'id'> & Partial<Pick<User, 'username' | 'display_name' | 'name'>>

export function userProfileRoute(user: Addressable | null | undefined): RouteLocationRaw | null {
  if (!user) return null

  if (user.username) {
    return { name: 'user-profile-by-username', params: { username: user.username } }
  }

  return { name: 'user-profile', params: { id: String(user.id) } }
}

/**
 * What to render as this person's name.
 *
 * `display_name` is the server's own resolved answer (it already falls back to
 * `name`), but it is absent from some payload shapes, so the fallback is kept
 * here rather than assumed.
 */
export function userDisplayName(user: Addressable | null | undefined): string {
  if (!user) return ''

  return user.display_name || user.name || ''
}
