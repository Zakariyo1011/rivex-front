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
      path: '/users/:id',
      name: 'user-profile',
      component: () => import('@/views/profile/PublicProfileView.vue'),
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
      path: '/admin/login',
      name: 'admin-login',
      component: () => import('@/views/admin/LoginView.vue'),
      meta: { adminGuest: true },
    },
    {
      path: '/admin',
      name: 'admin-dashboard',
      component: () => import('@/views/admin/DashboardView.vue'),
      meta: { requiresAdminAuth: true },
    },
    {
      path: '/admin/users',
      name: 'admin-users',
      component: () => import('@/views/admin/UsersView.vue'),
      meta: { requiresAdminAuth: true },
    },
    {
      path: '/admin/activities',
      name: 'admin-activities',
      component: () => import('@/views/admin/ActivitiesView.vue'),
      meta: { requiresAdminAuth: true },
    },
    {
      path: '/admin/reports',
      name: 'admin-reports',
      component: () => import('@/views/admin/ReportsView.vue'),
      meta: { requiresAdminAuth: true },
    },
    {
      path: '/admin/verifications',
      name: 'admin-verifications',
      component: () => import('@/views/admin/VerificationsView.vue'),
      meta: { requiresAdminAuth: true },
    },
    {
      path: '/admin/withdrawals',
      name: 'admin-withdrawals',
      component: () => import('@/views/admin/WithdrawalsView.vue'),
      meta: { requiresAdminAuth: true },
    },
    {
      path: '/admin/settings',
      name: 'admin-settings',
      component: () => import('@/views/admin/SettingsView.vue'),
      meta: { requiresAdminAuth: true },
    },
    {
      path: '/admin/audit-logs',
      name: 'admin-audit-logs',
      component: () => import('@/views/admin/AuditLogsView.vue'),
      meta: { requiresAdminAuth: true },
    },
  ],
})

router.beforeEach((to) => {
  if (to.meta.requiresAdminAuth || to.meta.adminGuest) {
    const admin = useAdminStore()

    if (to.meta.requiresAdminAuth && !admin.isAuthenticated) {
      return { name: 'admin-login' }
    }

    if (to.meta.adminGuest && admin.isAuthenticated) {
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
})

export default router
