export interface Profile {
  avatar_url: string | null
  bio: string | null
  age: number | null
  location_name: string | null
}

export interface User {
  id: number
  /**
   * The handle, without the `@`. Null until the account picks one — every
   * user who predates handles still has none, so anything rendering it must
   * cope with the absence rather than assume it.
   */
  username: string | null
  /** What to render. The server already falls back to `name`. */
  display_name: string
  name: string
  /**
   * Only ever present for the signed-in user themselves (and for admins in the
   * admin panel). Embedded and broadcast payloads carry the `phone_verified`
   * badge instead — never the number.
   */
  phone?: string
  phone_verified: boolean
  identity_verified: boolean
  /** Coarse status only — no document, number or file ever reaches the client. */
  verification_status: KycStatus
  status: string
  profile: Profile
  /**
   * Present and true when the viewer may not read this profile's contents.
   * Distinguishes a closed profile from an empty one — without it, a private
   * account renders as somebody who simply never filled anything in.
   */
  is_restricted?: boolean
  rating_average?: number | null
  reviews_count?: number
  no_show_count?: number
  completed_activities_count?: number
  trust_score?: number
  created_at: string
}

/**
 * An activity category — a node in a two-level tree since 11.5.
 *
 * `GET /categories` returns roots only, exactly as it always has, so anything
 * reading that endpoint sees no change. `children` arrives only from
 * `GET /categories/tree`, which is why it is optional rather than an empty
 * array: absent means "not asked for", not "has none".
 */
export interface Category {
  id: number
  name: string
  slug: string
  icon: string | null
  /** Null on a root. Lets a client tell a shelf from a leaf. */
  parent_id?: number | null
  children?: Category[]

  /**
   * Search-only, and optional for the same reason `children` is: the flat and
   * tree endpoints do not load them, and absent is not the same as zero.
   */
  parent?: Category | null
  activities_count?: number
}

export interface Region {
  id: number
  name: string
  code: string
}

export interface District {
  id: number
  region_id: number
  name: string
  code: string
}

export interface ActivityLocation {
  region: Region | null
  district: District | null
}

export interface UserLocation {
  region: Region | null
  district: District | null
  latitude: string | null
  longitude: string | null
}

export type PaymentType = 'free' | 'shared_cost' | 'owner_pays' | 'participant_pays'
export type ActivityStatus =
  'draft' | 'published' | 'full' | 'in_progress' | 'completed' | 'cancelled' | 'expired'

export interface Activity {
  id: number
  title: string
  description: string | null
  image_url: string | null
  category: Category
  location_name: string
  latitude: string | null
  longitude: string | null
  location?: ActivityLocation
  start_at: string
  duration_minutes: number | null
  people_needed: number
  payment_type: PaymentType
  amount: number
  status: ActivityStatus
  owner_confirmed_completed_at: string | null
  cancellation_reason: CancellationReason | null
  cancellation_note: string | null
  cancelled_at: string | null
  cancelled_late: boolean
  my_participant_id?: number
  my_participation_confirmed_at?: string | null
  /**
   * People the caller may still review on this activity. Server-computed and
   * present only on the detail endpoint; empty unless the activity is
   * completed and the caller took part.
   */
  my_reviewable_users?: User[]
  distance_km?: number
  owner: User
  created_at: string
}

export type ApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'expired'

export interface Application {
  id: number
  message: string | null
  status: ApplicationStatus
  activity: Activity
  applicant: User
  created_at: string
}

export interface Message {
  id: number
  conversation_id: number
  body: string
  type: 'text' | 'image'
  sender: User
  /** When the other side read it, or null. Absent on optimistic local rows. */
  read_at?: string | null
  created_at: string
  pending?: boolean
  failed?: boolean
}

/**
 * Whether this viewer may open a conversation with the profile they are looking
 * at, and why not when they may not.
 *
 * The reason for a block is deliberately worded as "no such user" — the same
 * answer a missing account gets — so the button cannot be used to detect one.
 */
export interface MessagingState {
  can_message: boolean
  reason: string | null
}

/**
 * A chat thread.
 *
 * `direct` is identified by the two people in it and is the *only* thread they
 * will ever have, however many activities they share. `activity` is a group
 * room identified by its activity.
 *
 * The two carry different identities on purpose: a direct conversation has a
 * `counterpart` and no `activity`, a group one the reverse. Rendering the
 * activity title as the name of a direct thread is what made four activities
 * with the same person look like four different chats.
 */
export interface Conversation {
  id: number
  type: 'direct' | 'activity'
  counterpart: User | null
  activity: Activity | null
  participants?: User[]
  last_message?: Message | null
  last_message_at: string | null
  unread_count: number
  created_at: string
}

export interface AppNotification {
  id: string
  type: string
  title: string
  body: string
  data: Record<string, unknown>
  read: boolean
  created_at: string
}

export type NotificationCategoryKey =
  | 'activity'
  | 'applications'
  | 'chat'
  | 'social'
  | 'payments'
  | 'reminders'
  | 'security'
  | 'verification'

export type NotificationChannelKey = 'in_app' | 'email' | 'sms'

/** category -> channel -> enabled. Always complete: the server merges defaults. */
export type NotificationPreferences = Record<
  NotificationCategoryKey,
  Record<NotificationChannelKey, boolean>
>

/**
 * Labels and disabled states come from the server so the client does not keep a
 * second, drifting copy of which categories exist and which channels work.
 */
export interface NotificationPreferencesMeta {
  categories: { value: NotificationCategoryKey; label: string; optional: boolean }[]
  channels: { value: NotificationChannelKey; label: string; available: boolean }[]
}

export interface Review {
  id: number
  rating: number | null
  comment: string | null
  is_no_show: boolean
  reviewer: User
  activity_id: number
  created_at: string
}

export interface Wallet {
  /** Spendable right now. */
  balance: number
  /** Reserved against withdrawal requests finance has not settled yet. */
  pending_balance: number
  available_balance: number
  /** balance + pending_balance — everything Rivex owes the user. */
  total_balance: number
  min_withdrawal: number
  currency: string
}

/** What a ledger entry was caused by. */
export type WalletReferenceType = 'payment' | 'invoice' | 'withdrawal' | string

export interface WalletTransaction {
  id: number
  type: 'credit' | 'debit'
  amount: number
  balance_after: number
  reference_type: WalletReferenceType | null
  reference_id: number | null
  description: string | null
  created_at: string
}

export type PaymentStatus =
  'pending' | 'waiting_for_payment' | 'paid' | 'failed' | 'cancelled' | 'refunded'

/** Invoices additionally lapse at their due date. */
export type InvoiceStatus = PaymentStatus | 'expired'

export type PaymentMethod = 'provider' | 'wallet'

export interface Payment {
  id: number
  invoice_id: number | null
  activity_id: number
  /** In the commission-only model this is the platform fee, not the activity price. */
  amount: number
  payment_type: PaymentType
  status: PaymentStatus
  payer: User
  recipient: User | null
  checkout_url?: string | null
  created_at: string
}

export interface Invoice {
  id: number
  invoice_number: string
  activity_id: number
  activity?: Activity
  amount: number
  commission_rate: number
  currency: string
  status: InvoiceStatus
  due_at: string | null
  paid_at: string | null
  created_at: string
}

export interface Block {
  id: number
  blocked_user: User
  created_at: string
}

export interface Report {
  id: number
  reason: string
  description: string | null
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed'
  reported_user: User
  created_at: string
}

/**
 * Wire value is `not_verified`, not `unverified` — the column and the admin
 * panel have always used that spelling, so it was kept rather than renamed.
 * `needs_review` means an automated provider could not decide and a human is
 * looking; the user has nothing to do but wait.
 */
export type KycStatus = 'not_verified' | 'pending' | 'verified' | 'rejected' | 'needs_review'

export type KycDocType = 'passport' | 'id_card'

/** Metadata only — the file bytes are admin-review-only and never linked here. */
export interface VerificationDocument {
  id: number
  doc_type: KycDocType | 'selfie'
  mime_type: string | null
  size_bytes: number | null
  /** Relative to the API base URL — the client prepends its own host. */
  path: string
  created_at: string
}

export interface IdentityVerification {
  id: number
  status: KycStatus
  status_label: string
  rejection_reason: string | null
  reviewed_at: string | null
  submitted_at: string | null
  attempts: number
  max_attempts: number
  can_submit: boolean
  user?: User
  /** Present only for admin callers. */
  documents?: VerificationDocument[]
}

/** Returned alongside `data` by GET /me so the router can route onboarding. */
/** Owner-only completion meter, served beside `data` by GET /me. */
export interface ProfileCompletion {
  percent: number
  missing: { key: string; label: string }[]
}

/**
 * The handle change policy, owner-only, served beside `data` by GET /me.
 *
 * This is what lets the edit screen apply the same rule the write applies.
 * `GET /username/available` answers about the handle — reserved, taken,
 * quarantined — and says nothing about whether *this* account may change right
 * now, so without this block a screen can show a free handle as available and
 * still have the save refused.
 *
 * Absent from every other user's payload on purpose: `changed_at` on a
 * stranger's profile announces a recent rename, which is the signal the
 * cooldown exists to suppress.
 */
export interface UsernamePolicy {
  username: string | null
  changed_at: string | null
  can_change_now: boolean
  next_change_allowed_at: string | null
  /** The one free correction after onboarding; unspent while true. */
  free_change_available: boolean
  cooldown_days: number
  min: number
  max: number
}

export interface OnboardingState {
  phone_verified: boolean
  location_selected: boolean
  /**
   * A handle is required to take part socially — to be findable, followed or
   * linked to. Enforced by the router guard rather than by the API, so that
   * accounts created before handles existed keep working while they are asked.
   */
  username_set: boolean
  identity_status: KycStatus
  completed: boolean
}

export interface Withdrawal {
  id: number
  amount: number
  status: 'pending' | 'approved' | 'rejected' | 'paid'
  user: User
  created_at: string
}

export interface AuditLog {
  id: number
  admin_name: string | null
  action: string
  entity_type: string | null
  entity_id: number | null
  meta: Record<string, unknown> | null
  created_at: string
}

/** Filter choices, derived server-side from the rows that actually exist. */
export interface AuditLogFilters {
  actions: string[]
  entity_types: string[]
  admins: { id: number; name: string }[]
}

export type AdminRole = 'super_admin' | 'finance' | 'moderator' | 'support'

/**
 * Permission strings mirror `App\Enums\AdminPermission`.
 *
 * Typed as a plain string set rather than a literal union: the server is the
 * authority, and a client that has not been redeployed should degrade by
 * hiding an unknown entry, not fail to compile.
 */
export interface AdminUser {
  id: number
  name: string
  email: string
  role: AdminRole
  role_label: string
  /** What this admin may do. Drives navigation only — never authorisation. */
  permissions: string[]
}

/** An admin account as the management screen sees it. Never carries a password. */
export interface AdminAccount {
  id: number
  name: string
  email: string
  role: AdminRole
  role_label: string
  permissions: string[]
  is_active: boolean
  password_changed_at: string | null
  active_sessions?: number
  created_at: string
}

export interface AdminRoleOption {
  value: AdminRole
  label: string
  permissions: string[]
}

export interface DashboardStats {
  total_users: number
  verified_users: number
  activities_today: number
  completed_activities: number
  /** Payments that actually cleared (status = paid). */
  total_transactions: number
  /** Commission earned and kept — reversed (refunded) rows are excluded. */
  platform_revenue: number
  refunded_commission: number
  unpaid_invoices: number
  pending_withdrawals: number
  pending_reports: number
  pending_verifications: number
}

export type FollowStatus = 'accepted' | 'pending'

/**
 * The viewer's tie to one account.
 *
 * Served **beside** the profile payload, never inside `data`: the user resource
 * is what goes out over WebSocket and is embedded in other people's payloads,
 * so a viewer-relative field there would attach one viewer's answer to a
 * message delivered to everybody.
 *
 * Both directions are reported because they are independent — following is not
 * symmetric, and "follows you" is what the button uses to offer "follow back".
 */
export interface FollowRelationship {
  /** Viewer → subject. */
  is_following: boolean
  follow_status: FollowStatus | null
  /** Subject → viewer. */
  is_followed_by: boolean
  can_follow: boolean
  /** Whether pressing follow will create a request rather than a follow. */
  follow_needs_approval: boolean
}

/**
 * Follower and following totals.
 *
 * Null when `who_can_see_followers` withholds them — a count is an aggregate of
 * the hidden list, so publishing it would leak membership one increment at a
 * time. `pending_requests` is present only on the owner's own `/me`.
 */
export interface FollowCounts {
  followers: number
  following: number
  pending_requests?: number
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    current_page: number
    last_page: number
    total: number
    per_page: number
  }
}

export type NoShowReportStatus =
  | 'reported'
  | 'awaiting_response'
  | 'confirmed'
  | 'disputed'
  | 'admin_review'
  | 'resolved'
  | 'withdrawn'

export interface NoShowReport {
  id: number
  status: NoShowReportStatus
  status_label: string
  activity_id: number
  activity?: Activity
  reporter?: User
  accused?: User
  reporter_note: string | null
  accused_response: string | null
  response_deadline_at: string | null
  responded_at: string | null
  resolved_at: string | null
  /** False once the window closed or a decision was made. */
  can_respond: boolean
  created_at: string
}

export type DisputeStatusValue = 'open' | 'under_review' | 'resolved'

export type DisputeResolution =
  'no_violation' | 'confirmed_no_show' | 'partial_fault' | 'cancelled' | 'refund' | 'no_refund'

export interface Dispute {
  id: number
  status: DisputeStatusValue
  status_label: string
  activity_id: number
  activity?: Activity
  reason: string
  resolution: DisputeResolution | null
  resolution_label: string | null
  resolution_note: string | null
  resolved_at: string | null
  no_show_report?: NoShowReport
  opened_by?: User
  created_at: string
}

export type CancellationReason =
  'plans_changed' | 'time_no_longer_works' | 'no_partner_found' | 'health' | 'other'
