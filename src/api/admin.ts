import adminClient from './adminClient'
import type {
  AdminAccount,
  AdminRole,
  AdminRoleOption,
  AdminUser,
  Activity,
  AuditLog,
  AuditLogFilters,
  AdminPaymentRow,
  AdminUserFinancials,
  AdminWalletRow,
  AdminWalletTransaction,
  DashboardStats,
  Dispute,
  FinancialOverview,
  FinancialSeries,
  DisputeResolution,
  IdentityVerification,
  PaginatedResponse,
  LedgerDirection,
  Report,
  TransactionFilters,
  User,
  WalletTransactionStatus,
  WalletTransactionType,
  Withdrawal,
} from '@/types'

export const adminAuthApi = {
  login(payload: { email: string; password: string }) {
    return adminClient.post<{ admin: AdminUser; token: string }>('/admin/login', payload)
  },
  logout() {
    return adminClient.post('/admin/logout')
  },
  /** Re-reads identity and permissions; the persisted copy can be stale. */
  me() {
    return adminClient.get<{ admin: AdminUser }>('/admin/me')
  },
  /** Every admin may rotate their own password; no permission required. */
  changeOwnPassword(payload: {
    current_password: string
    password: string
    password_confirmation: string
  }) {
    return adminClient.post<{ message: string }>('/admin/me/password', payload)
  },
}

/**
 * Admin account management. Super admin only — the server enforces it via
 * `admin.can:admins.manage`; the client merely avoids showing the screen.
 */
export const adminAccountsApi = {
  list(params: { q?: string; role?: string; page?: number } = {}) {
    return adminClient.get<PaginatedResponse<AdminAccount> & { meta: { roles: AdminRoleOption[] } }>(
      '/admin/admins',
      { params },
    )
  },
  create(payload: {
    name: string
    email: string
    password: string
    password_confirmation: string
    role: AdminRole
    is_active?: boolean
  }) {
    return adminClient.post<{ data: AdminAccount }>('/admin/admins', payload)
  },
  update(id: number, payload: Partial<{ name: string; email: string; role: AdminRole; is_active: boolean }>) {
    return adminClient.put<{ data: AdminAccount }>(`/admin/admins/${id}`, payload)
  },
  remove(id: number) {
    return adminClient.delete<{ message: string }>(`/admin/admins/${id}`)
  },
  resetPassword(id: number, payload: { password: string; password_confirmation: string }) {
    return adminClient.post<{ message: string }>(`/admin/admins/${id}/password`, payload)
  },
  revokeSessions(id: number) {
    return adminClient.post<{ message: string; revoked: number }>(`/admin/admins/${id}/revoke-sessions`)
  },
}

/**
 * The mock financial system, for administrators.
 *
 * Every one of these is gated by `finance.view` on the server (and refunds and
 * adjustments by more than that), so a client that renders a screen it may not
 * see gets a 403 rather than data. The permission strings the nav filters on
 * match App\Enums\AdminPermission.
 */
export const adminFinanceApi = {
  statistics(days = 30) {
    return adminClient.get<{ data: FinancialOverview; series: FinancialSeries }>(
      '/admin/payment-statistics',
      { params: { days } },
    )
  },

  wallets(params: { q?: string; page?: number; per_page?: number } = {}) {
    return adminClient.get<{
      data: AdminWalletRow[]
      meta: { current_page: number; last_page: number; per_page: number; total: number }
      test_mode: boolean
    }>('/admin/wallets', { params })
  },

  transactions(
    params: {
      type?: WalletTransactionType | ''
      direction?: LedgerDirection | ''
      status?: WalletTransactionStatus | ''
      user_id?: number
      activity_id?: number
      from?: string
      to?: string
      q?: string
      page?: number
      per_page?: number
    } = {},
  ) {
    return adminClient.get<
      PaginatedResponse<AdminWalletTransaction> & {
        filters: TransactionFilters
        test_mode: boolean
      }
    >('/admin/transactions', { params })
  },

  payments(
    params: { status?: string; user_id?: number; activity_id?: number; page?: number } = {},
  ) {
    return adminClient.get<{
      data: AdminPaymentRow[]
      meta: { current_page: number; last_page: number; per_page: number; total: number }
    }>('/admin/payments', { params })
  },

  userFinancials(userId: number, params: { page?: number } = {}) {
    return adminClient.get<{
      data: AdminUserFinancials
      transactions: PaginatedResponse<AdminWalletTransaction>
    }>(`/admin/users/${userId}/financials`, { params })
  },

  /** Reverses a completed payment. Idempotent; a reason is mandatory. */
  refund(paymentId: number, reason: string) {
    return adminClient.post<{ message: string; data: { id: number; status: string } }>(
      `/admin/payments/${paymentId}/refund`,
      { reason },
    )
  },

  /** Corrects a balance by hand. Positive credits, negative debits. */
  adjust(userId: number, amount: number, reason: string) {
    return adminClient.post<{ message: string; data: AdminWalletTransaction }>(
      `/admin/users/${userId}/wallet/adjust`,
      { amount, reason },
    )
  },
}

export const adminApi = {
  dashboard(days = 30) {
    return adminClient.get<{
      data: DashboardStats
      finance: FinancialOverview
      series: FinancialSeries
    }>('/admin/dashboard', { params: { days } })
  },
  users(params: { q?: string; status?: string; page?: number } = {}) {
    return adminClient.get<PaginatedResponse<User>>('/admin/users', { params })
  },
  user(id: number) {
    return adminClient.get<{ data: User }>(`/admin/users/${id}`)
  },
  updateUserStatus(id: number, status: 'active' | 'suspended' | 'banned') {
    return adminClient.post<{ data: User }>(`/admin/users/${id}/status`, { status })
  },
  activities(params: { status?: string; page?: number } = {}) {
    return adminClient.get<PaginatedResponse<Activity>>('/admin/activities', { params })
  },
  moderateActivity(id: number, reason?: string) {
    return adminClient.post<{ data: Activity }>(`/admin/activities/${id}/moderate`, { reason })
  },
  reports(params: { status?: string; page?: number } = {}) {
    return adminClient.get<PaginatedResponse<Report>>('/admin/reports', { params })
  },
  resolveReport(id: number, status: 'reviewed' | 'resolved' | 'dismissed') {
    return adminClient.post<{ data: Report }>(`/admin/reports/${id}/resolve`, { status })
  },
  verifications(params: { status?: string; page?: number } = {}) {
    return adminClient.get<PaginatedResponse<IdentityVerification>>('/admin/verifications', { params })
  },
  approveVerification(id: number) {
    return adminClient.post<{ data: IdentityVerification }>(`/admin/verifications/${id}/approve`)
  },
  rejectVerification(id: number, reason: string) {
    return adminClient.post<{ data: IdentityVerification }>(`/admin/verifications/${id}/reject`, { reason })
  },
  withdrawals(params: { status?: string; page?: number } = {}) {
    return adminClient.get<PaginatedResponse<Withdrawal>>('/admin/withdrawals', { params })
  },
  approveWithdrawal(id: number) {
    return adminClient.post<{ data: Withdrawal }>(`/admin/withdrawals/${id}/approve`)
  },
  rejectWithdrawal(id: number) {
    return adminClient.post<{ data: Withdrawal }>(`/admin/withdrawals/${id}/reject`)
  },
  settings() {
    return adminClient.get<{ data: { commission_rate: number } }>('/admin/settings')
  },
  updateCommission(rate: number) {
    return adminClient.put<{ data: { commission_rate: number } }>('/admin/settings/commission', {
      commission_rate: rate,
    })
  },
  disputes(params: { status?: string; q?: string; page?: number } = {}) {
    return adminClient.get<PaginatedResponse<Dispute>>('/admin/disputes', { params })
  },
  dispute(id: number) {
    return adminClient.get<{ data: Dispute }>(`/admin/disputes/${id}`)
  },
  /**
   * The resolution enum is the backend's; the client never computes what a
   * decision implies for trust score or money — it only reports which lever the
   * admin pulled.
   */
  resolveDispute(id: number, resolution: DisputeResolution, note?: string) {
    return adminClient.post<{ data: Dispute }>(`/admin/disputes/${id}/resolve`, {
      resolution,
      note,
    })
  },
  auditLogs(
    params: {
      page?: number
      admin_id?: number
      action?: string
      entity_type?: string
      from?: string
      to?: string
      q?: string
    } = {},
  ) {
    return adminClient.get<PaginatedResponse<AuditLog> & { meta: AuditLogFilters }>(
      '/admin/audit-logs',
      { params },
    )
  },
}
