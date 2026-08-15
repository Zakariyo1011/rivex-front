import { describe, it, expect } from 'vitest'
import { userProfileRoute, userDisplayName } from '@/lib/userLink'

/**
 * The rule these tests protect is the fallback, not the happy path.
 *
 * An account that has not chosen a handle has `username: null`, and a copy of
 * this rule that forgets that produces `/u/null` — a link that reviews fine,
 * works for every seeded user, and 404s for exactly the people who signed up
 * most recently. It was written by hand in six components before it lived here.
 */
describe('userProfileRoute', () => {
  it('addresses a user by handle when they have one', () => {
    expect(userProfileRoute({ id: 7, username: 'jasur' })).toEqual({
      name: 'user-profile-by-username',
      params: { username: 'jasur' },
    })
  })

  it('falls back to the id route when there is no handle', () => {
    expect(userProfileRoute({ id: 7, username: null })).toEqual({
      name: 'user-profile',
      params: { id: '7' },
    })
  })

  it('treats an empty handle as no handle', () => {
    expect(userProfileRoute({ id: 7, username: '' })).toEqual({
      name: 'user-profile',
      params: { id: '7' },
    })
  })

  it('treats a missing handle field as no handle', () => {
    expect(userProfileRoute({ id: 7 })).toEqual({
      name: 'user-profile',
      params: { id: '7' },
    })
  })

  it('returns null rather than a broken route for no user', () => {
    expect(userProfileRoute(null)).toBeNull()
    expect(userProfileRoute(undefined)).toBeNull()
  })
})

describe('userDisplayName', () => {
  it('prefers the display name', () => {
    expect(userDisplayName({ id: 1, display_name: 'Jasur A.', name: 'Jasur Aliyev' })).toBe('Jasur A.')
  })

  it('falls back to the name', () => {
    expect(userDisplayName({ id: 1, name: 'Jasur Aliyev' })).toBe('Jasur Aliyev')
  })

  it('falls back to the name when the display name is empty', () => {
    expect(userDisplayName({ id: 1, display_name: '', name: 'Jasur Aliyev' })).toBe('Jasur Aliyev')
  })

  it('renders nothing rather than "undefined" for a missing user', () => {
    expect(userDisplayName(null)).toBe('')
    expect(userDisplayName({ id: 1 })).toBe('')
  })
})
