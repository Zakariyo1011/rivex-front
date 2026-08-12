import type { RouteLocationRaw } from 'vue-router'
import { icons } from './icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import type { AppNotification } from '@/types'

/**
 * Where tapping a notification should take you, and how it should look.
 *
 * Previously the bell knew one rule — "if there is an activity_id, open the
 * activity" — so a refund, a dispute ruling and a no-show report all led to the
 * wrong screen or nowhere at all. The mapping lives here, in one table, because
 * every new notification type needs an answer to this question and the answer
 * belongs next to the others rather than inside a component.
 *
 * The `type` strings are the backend's `RivexNotification::type()` values;
 * they are the contract between the two sides.
 */

export type NotificationTone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral'

interface NotificationPresentation {
  icon: IconDefinition
  tone: NotificationTone
  /** Returns null when the notification is informational with nowhere to go. */
  to: (notification: AppNotification) => RouteLocationRaw | null
}

const activityLink = (notification: AppNotification): RouteLocationRaw | null => {
  const id = notification.data.activity_id
  return id ? { name: 'activity-detail', params: { id: String(id) } } : null
}

const incomingApplicationsLink = (notification: AppNotification): RouteLocationRaw | null => {
  const id = notification.data.activity_id
  return id ? { name: 'incoming-applications', params: { id: String(id) } } : null
}

const noShowLink = (): RouteLocationRaw => ({ name: 'no-show-reports' })
const walletLink = (): RouteLocationRaw => ({ name: 'wallet' })

const PRESENTATION: Record<string, NotificationPresentation> = {
  // Applications
  new_application: { icon: icons.applications, tone: 'primary', to: incomingApplicationsLink },
  application_accepted: { icon: icons.check, tone: 'success', to: activityLink },
  application_rejected: { icon: icons.close, tone: 'neutral', to: activityLink },

  // Activity
  participant_joined: { icon: icons.profile, tone: 'primary', to: activityLink },
  activity_cancelled: { icon: icons.close, tone: 'danger', to: activityLink },
  activity_reminder: { icon: icons.time, tone: 'warning', to: activityLink },

  // No-show and disputes always resolve to the screen where the user can act.
  no_show_reported: { icon: icons.warning, tone: 'danger', to: noShowLink },
  dispute_resolved: { icon: icons.trust, tone: 'primary', to: noShowLink },

  // Money
  payment_successful: { icon: icons.amount, tone: 'success', to: walletLink },
  payment_refunded: { icon: icons.amount, tone: 'success', to: walletLink },
  withdrawal_resolved: { icon: icons.amount, tone: 'primary', to: walletLink },

  // Verification
  verification_approved: { icon: icons.verified, tone: 'success', to: () => ({ name: 'verification-status' }) },
  verification_rejected: { icon: icons.warning, tone: 'danger', to: () => ({ name: 'verification-status' }) },
}

const FALLBACK: NotificationPresentation = {
  icon: icons.notifications,
  tone: 'neutral',
  // An unknown type is a client older than the server. Sending the user
  // somewhere arbitrary would be worse than leaving the row inert.
  to: () => null,
}

export function notificationPresentation(notification: AppNotification): NotificationPresentation {
  return PRESENTATION[notification.type] ?? FALLBACK
}

export function notificationTarget(notification: AppNotification): RouteLocationRaw | null {
  return notificationPresentation(notification).to(notification)
}
