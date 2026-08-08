<script setup lang="ts">
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useAdminStore } from '@/stores/admin'

const route = useRoute()
const router = useRouter()
const admin = useAdminStore()

const items = [
  { name: 'admin-dashboard', label: 'Dashboard', icon: '📊' },
  { name: 'admin-users', label: 'Users', icon: '👥' },
  { name: 'admin-activities', label: 'Activities', icon: '🎯' },
  { name: 'admin-reports', label: 'Reports', icon: '🚩' },
  { name: 'admin-verifications', label: 'Verification', icon: '🪪' },
  { name: 'admin-withdrawals', label: 'Withdrawals', icon: '💸' },
  { name: 'admin-settings', label: 'Settings', icon: '⚙️' },
  { name: 'admin-audit-logs', label: 'Audit Logs', icon: '📜' },
]

async function logout() {
  await admin.logout()
  router.push({ name: 'admin-login' })
}
</script>

<template>
  <div class="min-h-screen bg-surface-muted flex">
    <aside class="w-60 shrink-0 bg-white border-r border-border h-screen sticky top-0 flex flex-col px-4 py-6">
      <div class="flex items-center gap-2 px-2 mb-8">
        <div class="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center text-white text-sm">🤝</div>
        <div>
          <p class="text-sm font-bold text-ink leading-tight">Rivex</p>
          <p class="text-[11px] text-ink-faint leading-tight">Admin panel</p>
        </div>
      </div>

      <nav class="flex-1 space-y-1">
        <RouterLink
          v-for="item in items"
          :key="item.name"
          :to="{ name: item.name }"
          class="flex items-center gap-3 px-3 h-10 rounded-xl text-sm font-medium transition"
          :class="
            route.name === item.name
              ? 'bg-primary-50 text-primary-700'
              : 'text-ink-muted hover:bg-surface-muted'
          "
        >
          <span class="text-base">{{ item.icon }}</span>
          {{ item.label }}
        </RouterLink>
      </nav>

      <div class="border-t border-border pt-4 px-2">
        <p class="text-sm font-semibold text-ink">{{ admin.admin?.name }}</p>
        <p class="text-xs text-ink-faint mb-3">{{ admin.admin?.role }}</p>
        <button class="text-sm text-danger font-medium" @click="logout">Chiqish</button>
      </div>
    </aside>

    <main class="flex-1 min-w-0 p-8">
      <slot />
    </main>
  </div>
</template>
