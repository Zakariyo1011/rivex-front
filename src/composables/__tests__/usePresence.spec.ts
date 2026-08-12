import { describe, it, expect } from 'vitest'
import { usePresence } from '@/composables/usePresence'

describe('usePresence', () => {
  it('starts with nobody online', () => {
    const presence = usePresence()

    expect(presence.others.value).toEqual([])
    expect(presence.isOnline(1)).toBe(false)
  })

  it('takes the initial roster from here()', () => {
    const presence = usePresence()

    presence.here([{ id: 2, name: 'A' }])

    expect(presence.isOnline(2)).toBe(true)
    expect(presence.connected.value).toBe(true)
  })

  it('adds and removes people as they come and go', () => {
    const presence = usePresence()

    presence.here([])
    presence.joining({ id: 3, name: 'B' })
    expect(presence.isOnline(3)).toBe(true)

    presence.leaving({ id: 3, name: 'B' })
    expect(presence.isOnline(3)).toBe(false)
  })

  /**
   * Two tabs produce two joins and, when one closes, one leave. Keying by id
   * stops that from reading as "went offline" while they are still there.
   */
  it('does not double-count one person with two connections', () => {
    const presence = usePresence()

    presence.here([])
    presence.joining({ id: 4, name: 'C' })
    presence.joining({ id: 4, name: 'C' })

    expect(presence.others.value).toHaveLength(1)
  })

  it('treats an unknown user id as offline', () => {
    const presence = usePresence()

    presence.here([{ id: 2, name: 'A' }])

    expect(presence.isOnline(undefined)).toBe(false)
    expect(presence.isOnline(99)).toBe(false)
  })

  /** With no socket we cannot claim anyone is online, so we claim nobody is. */
  it('empties the roster on reset', () => {
    const presence = usePresence()

    presence.here([{ id: 2, name: 'A' }])
    presence.reset()

    expect(presence.others.value).toEqual([])
    expect(presence.connected.value).toBe(false)
  })
})
