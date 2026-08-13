export interface Profile {
  avatar_url: string | null
  bio: string | null
  age: number | null
  location_name: string | null
  visibility?: 'public' | 'private'
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
  rating_average?: number | null
  reviews_count?: number
  no_show_count?: number
  completed_activities_count?: number
  trust_score?: number
  created_at: string
}

export interface Category {
  id: number
  name: string
  slug: string
  icon: string | null
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

/** A user in the context of a match. Alias, not a distinct shape. */
export type MatchParticipant = User

export interface ActivityMatch {
  id: number
  status: 'active' | 'cancelled' | 'completed'
  activity: Activity
  participants: MatchParticipant[]
  created_at: string
}

export interface Message {
  id: number
  match_id: number
  body: string
  type: 'text' | 'image'
  sender: User
  /** When the other side read it, or null. Absent on optimistic local rows. */
  read_at?: string | null
  created_at: string
  pending?: boolean
  failed?: boolean
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
