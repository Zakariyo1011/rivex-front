import { describe, it, expect } from 'vitest'
import { notificationTarget, notificationPresentation } from '@/lib/notificationLinks'
import type { AppNotification } from '@/types'

function notification(type: string, data: Record<string, unknown> = {}): AppNotification {
  return {
    id: 'n-1',
    type,
    title: 'T',
    body: 'B',
    data,
    read: false,
    created_at: new Date().toISOString(),
  }
}

describe('notification deep links', () => {
  it('sends an accepted application to the activity', () => {
    expect(notificationTarget(notification('application_accepted', { activity_id: 12 }))).toEqual({
      name: 'activity-detail',
      params: { id: '12' },
    })
  })

  /** The organiser wants the queue they can act on, not the public page. */
  it('sends a new application to the incoming applications queue', () => {
    expect(notificationTarget(notification('new_application', { activity_id: 12 }))).toEqual({
      name: 'incoming-applications',
      params: { id: '12' },
    })
  })

  /**
   * These two used to land on the activity page, which has no way to answer a
   * report — the whole reason the deep-link table exists.
   */
  it('sends a no-show report to the screen where it can be answered', () => {
    expect(notificationTarget(notification('no_show_reported', { activity_id: 5 }))).toEqual({
      name: 'no-show-reports',
    })
  })

  it('sends a dispute outcome to the same place', () => {
    expect(notificationTarget(notification('dispute_resolved', { dispute_id: 3 }))).toEqual({
      name: 'no-show-reports',
    })
  })

  it.each(['payment_successful', 'payment_refunded', 'withdrawal_resolved'])(
    'sends %s to the wallet',
    (type) => {
      expect(notificationTarget(notification(type))).toEqual({ name: 'wallet' })
    },
  )

  it.each(['verification_approved', 'verification_rejected'])(
    'sends %s to the verification status screen',
    (type) => {
      expect(notificationTarget(notification(type))).toEqual({ name: 'verification-status' })
    },
  )

  it('has no destination when the activity id is missing', () => {
    expect(notificationTarget(notification('application_accepted'))).toBeNull()
  })

  /** A client older than the server must not guess where to go. */
  it('returns no destination for an unknown type', () => {
    expect(notificationTarget(notification('something_invented_later'))).toBeNull()
  })

  it('still gives an unknown type a renderable icon and tone', () => {
    const presentation = notificationPresentation(notification('something_invented_later'))

    expect(presentation.icon).toBeDefined()
    expect(presentation.tone).toBe('neutral')
  })

  it('marks a cancelled activity as a danger tone', () => {
    expect(notificationPresentation(notification('activity_cancelled')).tone).toBe('danger')
  })
})
