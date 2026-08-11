<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import Avatar from '@/components/ui/Avatar.vue'
import { mainNavItems } from '@/lib/nav'
import { icons } from '@/lib/icons'

const route = useRoute()
const { t } = useI18n()
const auth = useAuthStore()
</script>

<template>
  <aside
    class="hidden tablet:flex tablet:w-20 desktop:w-72 flex-col shrink-0 border-r border-border bg-surface h-screen sticky top-0 px-3 desktop:px-5 py-6 transition-[width]"
  >
    <div class="flex items-center gap-2 px-2 mb-8 justify-center desktop:justify-start">
      <div class="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center text-white text-sm shrink-0">
        <FontAwesomeIcon :icon="icons.brand" />
      </div>
      <span class="hidden desktop:inline text-lg font-bold text-ink">Rivex</span>
    </div>

    <RouterLink :to="{ name: 'activity-create' }" class="mb-6">
      <button
        class="w-full h-11 rounded-xl bg-primary-600 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary-700 transition"
      >
        <FontAwesomeIcon :icon="icons.add" />
        <span class="hidden desktop:inline">{{ t('nav.createActivity') }}</span>
      </button>
    </RouterLink>

    <nav class="flex-1 space-y-1">
      <RouterLink
        v-for="item in mainNavItems"
        :key="item.name"
        :to="{ name: item.name }"
        class="relative flex items-center gap-3 px-3 h-11 rounded-xl text-[15px] font-medium transition justify-center desktop:justify-start"
        :class="route.name === item.name ? 'bg-primary-50 text-primary-700' : 'text-ink-muted hover:bg-surface-muted'"
      >
        <span
          v-if="route.name === item.name"
          class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-primary-600"
        />
        <FontAwesomeIcon :icon="item.icon" class="text-base shrink-0" />
        <span class="hidden desktop:inline">{{ t(item.labelKey) }}</span>
      </RouterLink>

      <RouterLink
        :to="{ name: 'settings' }"
        class="relative flex items-center gap-3 px-3 h-11 rounded-xl text-[15px] font-medium transition justify-center desktop:justify-start"
        :class="route.name === 'settings' ? 'bg-primary-50 text-primary-700' : 'text-ink-muted hover:bg-surface-muted'"
      >
        <span
          v-if="route.name === 'settings'"
          class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-primary-600"
        />
        <FontAwesomeIcon :icon="icons.settings" class="text-base shrink-0" />
        <span class="hidden desktop:inline">{{ t('nav.settings') }}</span>
      </RouterLink>
    </nav>

    <RouterLink
      :to="{ name: 'profile' }"
      class="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-muted transition justify-center desktop:justify-start"
    >
      <Avatar :src="auth.user?.profile.avatar_url" :name="auth.user?.name ?? '?'" size="sm" />
      <div class="min-w-0 hidden desktop:block">
        <p class="text-sm font-semibold text-ink truncate">{{ auth.user?.name }}</p>
        <p class="text-xs text-ink-faint">Profilni ko'rish</p>
      </div>
    </RouterLink>
  </aside>
</template>
