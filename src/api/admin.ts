import adminClient from './adminClient'
import type {
  AdminUser,
  Activity,
  AuditLog,
  DashboardStats,
  IdentityVerification,
  PaginatedResponse,
  Report,
  User,
  Withdrawal,
} from '@/types'

export const adminAuthApi = {
  login(payload: { email: string; password: string }) {
    return adminClient.post<{ admin: AdminUser; token: string }>('/admin/login', payload)
  },
  logout() {
    return adminClient.post('/admin/logout')
  },
}

export const adminApi = {
  dashboard() {
    return adminClient.get<{ data: DashboardStats }>('/admin/dashboard')
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
  auditLogs(page = 1) {
    return adminClient.get<PaginatedResponse<AuditLog>>('/admin/audit-logs', { params: { page } })
  },
}
