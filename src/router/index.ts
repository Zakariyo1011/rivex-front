import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAdminStore } from '@/stores/admin'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/auth/welcome',
      name: 'welcome',
      component: () => import('@/views/auth/WelcomeView.vue'),
      meta: { guest: true },
    },
    {
      path: '/auth/login',
      name: 'login',
      component: () => import('@/views/auth/LoginView.vue'),
      meta: { guest: true },
    },
    {
      path: '/auth/register',
      name: 'register',
      component: () => import('@/views/auth/RegisterView.vue'),
      meta: { guest: true },
    },
    {
      path: '/auth/verify-phone',
      name: 'verify-phone',
      component: () => import('@/views/auth/VerifyPhoneView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/auth/location',
      name: 'onboarding-location',
      component: () => import('@/views/auth/OnboardingLocationView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/auth/username',
      name: 'onboarding-username',
      component: () => import('@/views/auth/OnboardingUsernameView.vue'),
      meta: { requiresAuth: true },
    },
    {
      // Offered after the required steps, never enforced by the guard.
      path: '/auth/interests',
      name: 'onboarding-interests',
      component: () => import('@/views/auth/OnboardingInterestsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/verification',
      name: 'verification-intro',
      component: () => import('@/views/verification/VerificationIntroView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/verification/document',
      name: 'verification-document',
      component: () => import('@/views/verification/VerificationDocumentView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/verification/selfie',
      name: 'verification-selfie',
      component: () => import('@/views/verification/VerificationSelfieView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/verification/status',
      name: 'verification-status',
      component: () => import('@/views/verification/VerificationStatusView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/home/HomeView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/explore',
      name: 'explore',
      component: () => import('@/views/explore/ExploreView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/activities/create',
      name: 'activity-create',
      component: () => import('@/views/activity/CreateActivityView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/activities/:id',
      name: 'activity-detail',
      component: () => import('@/views/activity/ActivityDetailView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/applications',
      name: 'applications',
      component: () => import('@/views/applications/ApplicationsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/activities/:id/applications',
      name: 'incoming-applications',
      component: () => import('@/views/applications/IncomingApplicationsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/chats',
      name: 'chats',
      component: () => import('@/views/chat/ChatsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/chats/:matchId',
      name: 'chat-detail',
      component: () => import('@/views/chat/ChatDetailView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('@/views/profile/ProfileView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/profile/edit',
      name: 'profile-edit',
      component: () => import('@/views/profile/ProfileEditView.vue'),
      meta: { requiresAuth: true },
    },
    {
      // Legacy, and kept: internal links that already hold an id use this.
      path: '/users/:id',
      name: 'user-profile',
      component: () => import('@/views/profile/PublicProfileView.vue'),
      meta: { requiresAuth: true },
    },
    {
      // Global search: people, activities and the category tree. Distinct from
      // `explore`, which browses activities with filters.
      path: '/search',
      name: 'search',
      component: () => import('@/views/search/SearchView.vue'),
      meta: { requiresAuth: true },
    },
    {
      // Followers, following, and — for the owner only — pending requests.
      // The tab is in the path so a link can point at a specific list.
      path: '/users/:id/connections/:tab?',
      name: 'follow-list',
      component: () => import('@/views/profile/FollowListView.vue'),
      meta: { requiresAuth: true },
    },
    {
      // Canonical public profile — the URL a person is given and shares.
      path: '/u/:username',
      name: 'user-profile-by-username',
      component: () => import('@/views/profile/PublicProfileView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/notifications',
      name: 'notifications',
      component: () => import('@/views/notifications/NotificationsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/settings/privacy',
      name: 'privacy-settings',
      component: () => import('@/views/settings/PrivacyView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/settings/notifications',
      name: 'notification-settings',
      component: () => import('@/views/settings/NotificationSettingsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      // Reports filed AGAINST the signed-in user, which they may still answer.
      path: '/no-show-reports',
      name: 'no-show-reports',
      component: () => import('@/views/noshow/NoShowReportsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/wallet',
      name: 'wallet',
      component: () => import('@/views/wallet/WalletView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/blocked-users',
      name: 'blocked-users',
      component: () => import('@/views/profile/BlockedUsersView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/safety-center',
      name: 'safety-center',
      component: () => import('@/views/safety/SafetyCenterView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/settings/SettingsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin/login',
      name: 'admin-login',
      component: () => import('@/views/admin/LoginView.vue'),
      meta: { adminGuest: true },
    },
    {
      path: '/admin',
      name: 'admin-dashboard',
      component: () => import('@/views/admin/DashboardView.vue'),
      meta: { requiresAdminAuth: true, permission: 'dashboard.view' },
    },
    {
      path: '/admin/users',
      name: 'admin-users',
      component: () => import('@/views/admin/UsersView.vue'),
      meta: { requiresAdminAuth: true, permission: 'users.view' },
    },
    {
      path: '/admin/activities',
      name: 'admin-activities',
      component: () => import('@/views/admin/ActivitiesView.vue'),
      meta: { requiresAdminAuth: true, permission: 'activities.view' },
    },
    {
      path: '/admin/reports',
      name: 'admin-reports',
      component: () => import('@/views/admin/ReportsView.vue'),
      meta: { requiresAdminAuth: true, permission: 'reports.view' },
    },
    {
      path: '/admin/verifications',
      name: 'admin-verifications',
      component: () => import('@/views/admin/VerificationsView.vue'),
      meta: { requiresAdminAuth: true, permission: 'verification.view' },
    },
    {
      path: '/admin/withdrawals',
      name: 'admin-withdrawals',
      component: () => import('@/views/admin/WithdrawalsView.vue'),
      meta: { requiresAdminAuth: true, permission: 'withdrawals.view' },
    },
    {
      path: '/admin/settings',
      name: 'admin-settings',
      component: () => import('@/views/admin/SettingsView.vue'),
      meta: { requiresAdminAuth: true, permission: 'settings.view' },
    },
    {
      path: '/admin/disputes',
      name: 'admin-disputes',
      component: () => import('@/views/admin/DisputesView.vue'),
      meta: { requiresAdminAuth: true, permission: 'disputes.view' },
    },
    {
      path: '/admin/admins',
      name: 'admin-admins',
      component: () => import('@/views/admin/AdminsView.vue'),
      meta: { requiresAdminAuth: true, permission: 'admins.manage' },
    },
    {
      path: '/admin/audit-logs',
      name: 'admin-audit-logs',
      component: () => import('@/views/admin/AuditLogsView.vue'),
      meta: { requiresAdminAuth: true, permission: 'audit-logs.view' },
    },
  ],
})

/**
 * Screens a half-onboarded user must still be able to reach, otherwise the
 * guard would bounce them away from the very page that unblocks them.
 */
const ONBOARDING_ROUTES = new Set(['verify-phone', 'onboarding-location', 'onboarding-username', 'onboarding-interests'])

router.beforeEach(async (to) => {
  if (to.meta.requiresAdminAuth || to.meta.adminGuest) {
    const admin = useAdminStore()

    if (to.meta.requiresAdminAuth && !admin.isAuthenticated) {
      return { name: 'admin-login' }
    }

    if (to.meta.adminGuest && admin.isAuthenticated) {
      return { name: 'admin-dashboard' }
    }

    if (!to.meta.requiresAdminAuth) return

    // Permissions come from the server, so they have to be loaded before the
    // check — otherwise a hard refresh onto a permitted page would bounce.
    await admin.ensureLoaded()

    // Convenience, not security: the endpoint behind the page is gated
    // server-side regardless. This only avoids rendering a screen whose every
    // request will 403.
    const required = to.meta.permission as string | undefined

    if (required && !admin.can(required)) {
      return { name: 'admin-dashboard' }
    }

    return
  }

  const auth = useAuthStore()

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'welcome' }
  }

  if (to.meta.guest && auth.isAuthenticated) {
    return { name: 'home' }
  }

  if (!to.meta.requiresAuth || !auth.isAuthenticated) return

  // One /me call per session tells us how far through onboarding they are.
  await auth.ensureLoaded()

  const onboarding = auth.onboarding
  if (!onboarding || ONBOARDING_ROUTES.has(to.name as string)) return

  // Phone first, then region. Identity verification is deliberately NOT forced
  // here: it is only required for paid activities and payouts, and those are
  // gated at the point of action (plus the banner on Home). Making everyone
  // upload a passport before they have seen the product would be a wall, not
  // an onboarding.
  if (!onboarding.phone_verified) {
    return { name: 'verify-phone' }
  }

  if (!onboarding.location_selected) {
    return { name: 'onboarding-location' }
  }

  // A handle comes last of the required steps, and only after the user has
  // seen enough of the product to care what they are called. It is enforced
  // here rather than by the API on purpose: every account created before
  // handles existed still has none, and rejecting their requests would lock
  // them out of an app they already use. The guard asks; the server does not
  // refuse.
  if (!onboarding.username_set) {
    return { name: 'onboarding-username' }
  }
})

export default router
