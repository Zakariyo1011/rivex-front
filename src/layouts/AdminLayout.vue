<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useAdminStore } from '@/stores/admin'
import { icons } from '@/lib/icons'
import AppDrawer from '@/components/ui/AppDrawer.vue'

const route = useRoute()
const router = useRouter()
const admin = useAdminStore()
const mobileNavOpen = ref(false)

const items = [
  { name: 'admin-dashboard', label: 'Dashboard', icon: icons.dashboard },
  { name: 'admin-users', label: 'Users', icon: icons.people },
  { name: 'admin-activities', label: 'Activities', icon: icons.activities },
  { name: 'admin-reports', label: 'Reports', icon: icons.report },
  { name: 'admin-verifications', label: 'Verification', icon: icons.identity },
  { name: 'admin-withdrawals', label: 'Withdrawals', icon: icons.amount },
  { name: 'admin-settings', label: 'Settings', icon: icons.settings },
  { name: 'admin-audit-logs', label: 'Audit Logs', icon: icons.auditLog },
]

watch(() => route.name, () => {
  mobileNavOpen.value = false
})

async function logout() {
  await admin.logout()
  router.push({ name: 'admin-login' })
}
</script>

<template>
  <div class="min-h-screen bg-surface-muted tablet:flex">
    <div class="tablet:hidden flex items-center justify-between px-4 h-14 border-b border-border bg-surface sticky top-0 z-30">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-lg bg-primary-600 flex items-center justify-center text-white text-xs">
          <FontAwesomeIcon :icon="icons.brand" />
        </div>
        <p class="text-sm font-bold text-ink">Rivex Admin</p>
      </div>
      <button
        class="w-9 h-9 rounded-full flex items-center justify-center text-ink-muted hover:bg-surface-muted"
        @click="mobileNavOpen = true"
      >
        <FontAwesomeIcon :icon="icons.menu" />
      </button>
    </div>

    <aside class="hidden tablet:flex tablet:w-20 desktop:w-60 shrink-0 bg-surface border-r border-border h-screen sticky top-0 flex-col px-3 desktop:px-4 py-6">
      <div class="flex items-center gap-2 px-2 mb-8 justify-center desktop:justify-start">
        <div class="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center text-white text-sm shrink-0">
          <FontAwesomeIcon :icon="icons.brand" />
        </div>
        <div class="hidden desktop:block">
          <p class="text-sm font-bold text-ink leading-tight">Rivex</p>
          <p class="text-[11px] text-ink-faint leading-tight">Admin panel</p>
        </div>
      </div>

      <nav class="flex-1 space-y-1">
        <RouterLink
          v-for="item in items"
          :key="item.name"
          :to="{ name: item.name }"
          class="flex items-center gap-3 px-3 h-10 rounded-xl text-sm font-medium transition justify-center desktop:justify-start"
          :class="
            route.name === item.name
              ? 'bg-primary-50 text-primary-700'
              : 'text-ink-muted hover:bg-surface-muted'
          "
        >
          <FontAwesomeIcon :icon="item.icon" class="w-4 shrink-0" />
          <span class="hidden desktop:inline">{{ item.label }}</span>
        </RouterLink>
      </nav>

      <div class="border-t border-border pt-4 px-2">
        <p class="hidden desktop:block text-sm font-semibold text-ink">{{ admin.admin?.name }}</p>
        <p class="hidden desktop:block text-xs text-ink-faint mb-3">{{ admin.admin?.role }}</p>
        <button
          class="text-sm text-danger font-medium flex items-center gap-1.5 justify-center desktop:justify-start w-full"
          @click="logout"
        >
          <FontAwesomeIcon :icon="icons.logout" />
          <span class="hidden desktop:inline">Chiqish</span>
        </button>
      </div>
    </aside>

    <AppDrawer v-if="mobileNavOpen" title="Rivex Admin" side="left" @close="mobileNavOpen = false">
      <nav class="space-y-1 -mx-2">
        <RouterLink
          v-for="item in items"
          :key="item.name"
          :to="{ name: item.name }"
          class="flex items-center gap-3 px-3 h-11 rounded-xl text-sm font-medium transition"
          :class="
            route.name === item.name
              ? 'bg-primary-50 text-primary-700'
              : 'text-ink-muted hover:bg-surface-muted'
          "
        >
          <FontAwesomeIcon :icon="item.icon" class="w-4 shrink-0" />
          {{ item.label }}
        </RouterLink>
      </nav>
      <div class="border-t border-border mt-4 pt-4">
        <p class="text-sm font-semibold text-ink">{{ admin.admin?.name }}</p>
        <p class="text-xs text-ink-faint mb-3">{{ admin.admin?.role }}</p>
        <button class="text-sm text-danger font-medium flex items-center gap-1.5" @click="logout">
          <FontAwesomeIcon :icon="icons.logout" />
          Chiqish
        </button>
      </div>
    </AppDrawer>

    <main class="flex-1 min-w-0 p-4 tablet:p-8">
      <slot />
    </main>
  </div>
</template>
