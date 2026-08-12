import type { ActivityStatus, ApplicationStatus, KycStatus } from '@/types'

/**
 * One place for every status → Uzbek label and badge colour.
 *
 * These maps were previously duplicated across eight views, which is how the
 * admin list ended up missing statuses the detail page already knew about.
 * The backend enums are the source of truth for the values; this is only how
 * they read.
 */
export type BadgeVariant = 'neutral' | 'primary' | 'success' | 'warning' | 'danger'

interface StatusPresentation<T extends string> {
  labels: Record<T, string>
  variants: Record<T, BadgeVariant>
}

export const activityStatus: StatusPresentation<ActivityStatus> = {
  labels: {
    draft: 'Qoralama',
    published: "E'lon qilingan",
    full: "To'lgan",
    in_progress: 'Davom etmoqda',
    completed: 'Yakunlangan',
    cancelled: 'Bekor qilingan',
    expired: "Muddati o'tgan",
  },
  variants: {
    draft: 'neutral',
    published: 'primary',
    full: 'success',
    in_progress: 'success',
    completed: 'neutral',
    cancelled: 'danger',
    expired: 'neutral',
  },
}

export const applicationStatus: StatusPresentation<ApplicationStatus> = {
  labels: {
    pending: 'Kutilmoqda',
    accepted: 'Qabul qilindi',
    rejected: 'Rad etildi',
    cancelled: 'Bekor qilindi',
    expired: "Muddati o'tdi",
  },
  variants: {
    pending: 'primary',
    accepted: 'success',
    rejected: 'danger',
    cancelled: 'neutral',
    expired: 'neutral',
  },
}

export const kycStatus: StatusPresentation<KycStatus> = {
  labels: {
    not_verified: 'Tasdiqlanmagan',
    pending: 'Kutilmoqda',
    needs_review: "Qo'shimcha tekshiruv",
    verified: 'Tasdiqlangan',
    rejected: 'Rad etilgan',
  },
  variants: {
    not_verified: 'neutral',
    pending: 'primary',
    needs_review: 'warning',
    verified: 'success',
    rejected: 'danger',
  },
}

export const noShowStatus = {
  labels: {
    reported: 'Yuborildi',
    awaiting_response: 'Javob kutilmoqda',
    confirmed: 'Tasdiqlandi',
    disputed: "E'tiroz bildirildi",
    admin_review: "Admin ko'rib chiqmoqda",
    resolved: 'Hal qilindi',
    withdrawn: 'Qaytarib olindi',
  } as Record<string, string>,
  variants: {
    reported: 'primary',
    awaiting_response: 'warning',
    confirmed: 'danger',
    disputed: 'warning',
    admin_review: 'primary',
    resolved: 'neutral',
    withdrawn: 'neutral',
  } as Record<string, BadgeVariant>,
}

export const disputeStatus = {
  labels: {
    open: 'Ochiq',
    under_review: "Ko'rib chiqilmoqda",
    resolved: 'Hal qilindi',
  } as Record<string, string>,
  variants: {
    open: 'warning',
    under_review: 'primary',
    resolved: 'success',
  } as Record<string, BadgeVariant>,
}

/** Reasons an organiser can pick when calling an activity off. */
export const cancellationReasons: { value: string; label: string }[] = [
  { value: 'plans_changed', label: "Reja o'zgardi" },
  { value: 'time_no_longer_works', label: 'Vaqt mos kelmay qoldi' },
  { value: 'no_partner_found', label: 'Sherik topilmadi' },
  { value: 'health', label: "Sog'liq / sababli" },
  { value: 'other', label: 'Boshqa' },
]
