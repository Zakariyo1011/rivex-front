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
  created_at: string
}

export interface Category {
  id: number
  name: string
  slug: string
  icon: string | null
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
  start_at: string
  duration_minutes: number | null
  people_needed: number
  payment_type: PaymentType
  amount: number
  status: ActivityStatus
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
  balance: number
  pending_balance: number
  currency: string
}

export interface WalletTransaction {
  id: number
  type: 'credit' | 'debit'
  amount: number
  balance_after: number
  description: string | null
  created_at: string
}

export interface Payment {
  id: number
  activity_id: number
  amount: number
  payment_type: PaymentType
  status: 'pending' | 'held' | 'completed' | 'released' | 'failed' | 'refunded' | 'cancelled'
  payer: User
  recipient: User
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
  total_transactions: number
  platform_revenue: number
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
