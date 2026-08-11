export interface Profile {
  avatar_url: string | null
  bio: string | null
  age: number | null
  location_name: string | null
  visibility?: 'public' | 'private'
}

export interface User {
  id: number
  name: string
  phone: string
  phone_verified: boolean
  identity_verified: boolean
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
  | 'draft'
  | 'published'
  | 'full'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'expired'

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
  my_participant_id?: number
  my_participation_confirmed_at?: string | null
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

export interface MatchParticipant extends User {}

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
  | 'pending'
  | 'waiting_for_payment'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'refunded'

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

export interface IdentityVerification {
  id: number
  status: 'not_verified' | 'pending' | 'verified' | 'rejected'
  rejection_reason: string | null
  reviewed_at: string | null
  submitted_at: string
  user: User
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

export interface AdminUser {
  id: number
  name: string
  email: string
  role: string
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
