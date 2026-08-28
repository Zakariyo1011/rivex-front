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
  phone?: string | null
  phone_verified: boolean
  /**
   * Present only for the owner and for admins, like `phone`. Google supplies
   * it at sign-up, so it is the identifier support is usually given.
   */
  email?: string | null
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
  /**
   * Present only where the server resolved presence — the conversation
   * payloads. Absent everywhere else, which is why it is optional rather than
   * defaulted to false: "not online" and "nobody asked" must render
   * differently, and a grey dot on every embedded user would be the second one
   * pretending to be the first.
   */
  is_online?: boolean
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
  category: Category
  location_name: string
  latitude: string | null
  longitude: string | null
  location?: ActivityLocation
  /**
   * Both endpoints, as UTC ISO-8601 with a `Z`.
   *
   * Rendered in the reader's own zone by `lib/datetime`. Never parse these with
   * anything that ignores the suffix: the API is explicit about the zone in
   * both directions precisely because a bare wall-clock string used to be read
   * as UTC and shifted every activity five hours into the evening.
   */
  start_at: string
  ends_at: string
  /** Derived server-side from the pair, so it can never disagree with them. */
  duration_minutes: number
  people_needed: number
  /** Seats taken. Present on the detail endpoint. */
  accepted_participants_count?: number
  /**
   * How far the two-sided completion confirmation has got. Present on the
   * detail endpoint while the activity can still be completed, and absent once
   * it is — there is nothing left to confirm.
   */
  completion_progress?: {
    confirmed: number
    total: number
    /** Display names of everyone whose confirmation is still owed. */
    waiting_on: string[]
  } | null
  /** Owner-only, and only on the "my activities" endpoint. */
  pending_applications_count?: number
  payment_type: PaymentType
  /** The peer-to-peer price the two people agreed on. */
  amount_minor: number
  amount: number
  amount_formatted: string
  currency: string
  /**
   * What Rivex would charge on this activity at today's rate. Present only
   * where the caller is about to act on the price — the detail screen, and the
   * response to creating or editing one.
   */
  pricing?: PaymentBreakdown
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
  /**
   * Whether `distance_km` was measured from the activity's own pin or inferred
   * from the centre of its district or region. Rendering a derived figure as if
   * it were measured is a more confident lie than showing a "~".
   */
  distance_approximate?: boolean
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

/**
 * The message a reply answers, trimmed to what a preview needs.
 *
 * Flattened by the server rather than nested as another `Message`: a nested
 * shape recurses (a reply to a reply carrying its own parent, and so on) and
 * would put an unbounded amount of history on every row.
 *
 * `deleted` is the case where the original is gone — the foreign key nulls
 * rather than cascading, so a reply outlives the message it answered — and then
 * `id`, `body` and `sender` are all null.
 */
export interface MessageReplyPreview {
  id: number | null
  deleted: boolean
  body: string | null
  /**
   * The original's kind, so a quote of a picture can say "Rasm" rather than
   * rendering the empty body a non-text message has. Null when the original is
   * gone, along with everything else about it.
   */
  type: Message['type'] | null
  sender: User | null
}

/**
 * One emoji's worth of reactions on a message.
 *
 * `user_ids` rather than a `reacted` boolean, because this exact shape is also
 * what arrives over the WebSocket, where there is no single viewer to be right
 * about — the same reason `read_at` is null on a broadcast. Each client decides
 * which id is its own.
 */
export interface MessageReactionGroup {
  emoji: string
  count: number
  user_ids: number[]
}

export interface Message {
  id: number
  conversation_id: number
  body: string
  type: 'text' | 'image'
  sender: User
  /** The message this one answers, or null when it answers nothing. */
  reply_to?: MessageReplyPreview | null
  /** Per-emoji buckets. Empty rather than absent when nobody has reacted. */
  reactions?: MessageReactionGroup[]
  /** When the other side read it, or null. Absent on optimistic local rows. */
  read_at?: string | null
  created_at: string
  pending?: boolean
  failed?: boolean
  /**
   * Why the send failed, in words meant for the sender.
   *
   * Local-only — the server never sends this. Derived by status so that a
   * block, a rate limit and an offline browser do not all read as the same
   * unexplained "Yuborilmadi". See `describeApiError`.
   */
  failed_reason?: string
}

/**
 * The five reactions Rivex offers, in picker order.
 *
 * Mirrors `MessageReaction::ALLOWED` server-side, which is authoritative — the
 * server rejects anything else with a 422. Duplicated here only so the picker
 * can render without a round trip; it is not a second source of truth, and a
 * reaction stored before this list last changed still renders, because the
 * badge row draws whatever the server sends rather than only what is listed.
 */
export const MESSAGE_REACTIONS = ['❤️', '😂', '👍', '😮', '😢'] as const

export type MessageReactionEmoji = (typeof MESSAGE_REACTIONS)[number]

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
  /** The whole room, not `participants.length` — the face pile shows a slice. */
  participants_count?: number
  last_message?: Message | null
  last_message_at: string | null
  unread_count: number
  created_at: string
}

/** Counts the navigation badges read. Delivered beside `/me`. */
export interface UserCounters {
  /** Applications awaiting a decision on activities this user organises. */
  pending_applications: number
}

export interface AppNotification {
  id: string
  type: string
  title: string
  body: string
  data: Record<string, unknown>
  read: boolean
  created_at: string
  /**
   * The person behind the notification, resolved live rather than stored in
   * `data` — an avatar written into the payload is the avatar from whenever the
   * event happened. Null when there is no actor, or when the viewer may no
   * longer see them.
   */
  actor?: User | null
  /**
   * The viewer's follow relationship with `actor`, on social rows only, so the
   * row can carry a working Follow button without a request per notification.
   */
  relationship?: FollowRelationship | null
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

/**
 * Every money figure arrives twice.
 *
 * `*_minor` is the exact integer the server reasons about — the amount in the
 * currency's smallest unit. The plain field is the same value in major units,
 * for display. The client never divides one into the other: a currency with a
 * different exponent is how that becomes a hundredfold bug, and only the server
 * knows the exponent.
 *
 * UZS has no subunit, so for now the two are equal. That is a fact about UZS,
 * not an invariant to rely on.
 */
export interface Wallet {
  currency: string
  /** Spendable right now. */
  balance_minor: number
  balance: number
  balance_formatted: string
  /** Reserved against withdrawal requests finance has not settled yet. */
  pending_balance_minor: number
  pending_balance: number
  available_balance_minor: number
  available_balance: number
  /** balance + pending_balance — everything Rivex owes the user. */
  total_balance_minor: number
  total_balance: number
  min_withdrawal_minor: number
  min_withdrawal: number
  /**
   * Whether this is simulated money. Comes from the SERVER, never from a build
   * flag — the truth about whether a balance is real is not the client's to
   * decide, and every screen that shows a number must be able to say so.
   */
  test_mode: boolean
  /** Whether the test top-up button should exist at all. */
  can_top_up: boolean
}

/** What a ledger entry was caused by. */
export type WalletReferenceType = 'payment' | 'invoice' | 'withdrawal' | 'test_top_up' | string

/**
 * What a ledger row IS, as opposed to which way the money went.
 *
 * The client used to derive this from the description string, which meant a
 * copy change silently broke the icons. It is a server-side enum now.
 */
export type WalletTransactionType =
  | 'test_top_up'
  | 'activity_fee'
  | 'activity_reservation'
  | 'commission'
  | 'settlement'
  | 'refund'
  | 'adjustment'
  | 'withdrawal'
  | 'withdrawal_reversal'

export type LedgerDirection = 'credit' | 'debit'

export type WalletTransactionStatus = 'pending' | 'completed' | 'reversed' | 'failed'

export interface WalletTransaction {
  id: number
  direction: LedgerDirection
  type: WalletTransactionType
  /** Already localised by the server, so one label exists rather than two. */
  type_label: string
  status: WalletTransactionStatus
  amount_minor: number
  amount: number
  amount_formatted: string
  currency: string
  balance_after_minor: number
  balance_after: number
  reference_type: WalletReferenceType | null
  reference_id: number | null
  description: string | null
  created_at: string
}

/**
 * How one activity's money divides.
 *
 * Computed entirely on the server: the client must never multiply a percentage
 * to work out a fee, or the number on screen and the number billed can differ.
 *
 * `platform_collected` is what actually moves through Rivex (today: the
 * commission alone) and `external_settled` is what the two people settle
 * between themselves. Keeping them apart is what lets the payment model change
 * later without rewriting every screen that shows a price.
 */
export interface PaymentBreakdown {
  currency: string
  activity_amount_minor: number
  activity_amount: number
  commission_rate: number
  commission_minor: number
  commission: number
  platform_collected_minor: number
  platform_collected: number
  external_settled_minor: number
  external_settled: number
  settlement_minor: number
  settlement: number
}

/**
 * `paid` is the completed/captured state — the only one in which money has
 * reached Rivex. It kept its original name because it is written into every
 * existing row; `authorized` is a genuinely different state, where a gateway
 * has reserved funds it has not captured.
 */
export type PaymentStatus =
  'pending' | 'waiting_for_payment' | 'authorized' | 'paid' | 'failed' | 'cancelled' | 'refunded'

/** Invoices additionally lapse at their due date. */
export type InvoiceStatus = PaymentStatus | 'expired'

export type PaymentMethod = 'provider' | 'wallet'

export interface Payment {
  id: number
  invoice_id: number | null
  activity_id: number
  /** In the commission-only model this is the platform fee, not the activity price. */
  amount_minor: number
  amount: number
  amount_formatted: string
  currency: string
  /** Where that figure came from. Always server-computed. */
  breakdown: PaymentBreakdown
  payment_type: PaymentType | null
  status: PaymentStatus
  provider: string | null
  failure_reason: string | null
  authorized_at: string | null
  completed_at: string | null
  refunded_at: string | null
  /** Only present when a redirect-based gateway returned one on this request. */
  checkout_url?: string | null
  created_at: string
}

export interface Invoice {
  id: number
  invoice_number: string
  activity_id: number
  activity?: Activity
  /** What Rivex charges — the platform fee, not the activity price. */
  amount_minor: number
  amount: number
  amount_formatted: string
  commission_rate: number
  currency: string
  /** The whole split the fee was calculated from. */
  breakdown: PaymentBreakdown
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

/** The kind of document a person presents. */
export type KycDocType = 'passport' | 'id_card'

/**
 * A stored PAGE, which is not the same thing as a document kind.
 *
 * A passport is one page; an ID card is two, and the back carries half of what
 * makes it verifiable. Naming the side here is what lets an admin listing say
 * which one it is about to open instead of inferring it from row order.
 */
export type KycDocPage = 'passport' | 'id_card_front' | 'id_card_back' | 'selfie'

/** Metadata only — the file bytes are admin-review-only and never linked here. */
export interface VerificationDocument {
  id: number
  doc_type: KycDocPage
  /** Human-readable page name, resolved server-side. */
  label: string
  mime_type: string | null
  size_bytes: number | null
  /** Relative to the API base URL — the client prepends its own host. */
  path: string
  created_at: string
}

/**
 * What an OCR reader believed the document said.
 *
 * Admin-only, and evidence rather than a verdict: there is deliberately no
 * status or score field here, because reading a document and deciding an
 * identity are different questions and only the second one verifies anybody.
 */
export interface ExtractedDocument {
  succeeded: boolean
  first_name: string | null
  last_name: string | null
  document_number: string | null
  date_of_birth: string | null
  expires_on: string | null
  failure_reason: string | null
}

export interface IdentityVerification {
  id: number
  status: KycStatus
  status_label: string
  document_type: KycDocType | null
  document_type_label: string | null
  /** The request fields a complete submission must carry, from the server. */
  required_pages: string[]
  /** Which provider decided. `dev_auto` is the local test verifier. */
  provider: string | null
  /** Admin-only. */
  extracted_document?: ExtractedDocument | null
  /** Admin-only. */
  document_reader?: string | null
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

/** Not added / awaiting a code / on the account / proved. */
export type PhoneStatus = 'not_added' | 'pending' | 'unverified' | 'verified'

export interface PhoneState {
  status: PhoneStatus
  phone: string | null
  pending_phone: string | null
  verified: boolean
  /** Pre-spaced by the server, so the client never encodes a numbering plan. */
  formatted?: string | null
  pending_formatted?: string | null
}

export interface OnboardingState {
  /** Google is the authentication method, so this is true for every account. */
  google_linked: boolean
  location_selected: boolean
  /**
   * A handle is required to take part socially — to be findable, followed or
   * linked to. Enforced by the router guard rather than by the API, so that
   * accounts created before handles existed keep working while they are asked.
   */
  username_set: boolean
  /**
   * Reported for the profile checklist, NOT a gate.
   *
   * The phone number moved to the profile when Google took over sign-in, so it
   * is enforced only at the point of action — creating or joining an activity —
   * and never by the onboarding guard. Putting an SMS between a new user and
   * the product was the thing this phase removed.
   */
  phone_status: PhoneStatus
  phone_verified: boolean
  identity_status: KycStatus
  completed: boolean
}

/** The balance summary served beside /me, so the profile needs no second call. */
export interface WalletSummary {
  balance_minor: number
  balance: number
  currency: string
  test_mode: boolean
}

/** What the security screen needs to know to render the right form. */
export interface SecurityOverview {
  google_linked: boolean
  google_email: string | null
  has_password: boolean
  phone_status: PhoneStatus
  active_sessions: number
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
  new_users_today: number
  new_users_this_week: number
  new_users_this_month: number
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

/**
 * A money figure as the admin API sends it: exact, displayable and labelled.
 *
 * The same three-part shape everywhere, so no admin screen has to decide how
 * to render an amount and none of them can decide differently.
 */
export interface AdminMoney {
  minor: number
  major: number
  formatted: string
  currency: string
}

/**
 * Every financial number the admin panel shows, computed from the database.
 *
 * `test_mode` and `gateway` are part of the payload rather than assumed by the
 * client: an administrator looking at revenue has to be able to tell simulated
 * money from real, and that is a fact about the server.
 */
export interface FinancialOverview {
  currency: string
  test_mode: boolean
  gateway: string
  commission_rate: number
  users: {
    total: number
    today: number
    this_week: number
    this_month: number
  }
  test_money: {
    total_added: AdminMoney
    today: AdminMoney
    wallet_balance: AdminMoney
    wallet_pending: AdminMoney
  }
  volume: {
    total: AdminMoney
    today: AdminMoney
    this_week: AdminMoney
    this_month: AdminMoney
  }
  commission: {
    total: AdminMoney
    today: AdminMoney
    this_week: AdminMoney
    this_month: AdminMoney
    reversed: AdminMoney
  }
  transactions: {
    wallet_movements: number
    payments_total: number
    payments_successful: number
    payments_failed: number
    payments_pending: number
    refunds: number
  }
}

export interface FinancialSeriesPoint {
  date: string
  registrations: number
  test_volume_minor: number
  test_volume: number
  commission_minor: number
  commission: number
}

export interface FinancialSeries {
  currency: string
  days: number
  points: FinancialSeriesPoint[]
}

export interface AdminWalletRow {
  id: number
  user: { id: number | null; name: string | null; username: string | null; email: string | null }
  currency: string
  balance: AdminMoney
  pending_balance: AdminMoney
  total_top_ups: AdminMoney
  total_spent: AdminMoney
  transactions_count: number
}

/** A ledger row plus who it belongs to and its idempotency reference. */
export interface AdminWalletTransaction extends WalletTransaction {
  wallet_id: number
  user: { id: number; name: string; username: string | null; email: string | null } | null
  /** Admin-only: the key that de-duplicates a movement. */
  reference: string | null
  metadata: Record<string, unknown> | null
}

export interface AdminPaymentRow {
  id: number
  user: { id: number | null; name: string | null; username: string | null }
  activity: { id: number; title: string } | null
  invoice_number: string | null
  amount: { minor: number; major: number; formatted: string }
  breakdown: PaymentBreakdown
  currency: string
  status: PaymentStatus
  provider: string | null
  reference: string | null
  failure_reason: string | null
  created_at: string
  completed_at: string | null
  refunded_at: string | null
}

export interface AdminUserFinancials {
  currency: string
  test_mode: boolean
  wallet: { exists: boolean; balance: AdminMoney; pending_balance: AdminMoney }
  totals: {
    test_top_ups: AdminMoney
    spent: AdminMoney
    refunded: AdminMoney
    commission_generated: AdminMoney
  }
  counts: {
    wallet_transactions: number
    payments: number
    payments_successful: number
    refunds: number
  }
}

export interface TransactionFilters {
  types: { value: WalletTransactionType; label: string }[]
  directions: LedgerDirection[]
  statuses: WalletTransactionStatus[]
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
