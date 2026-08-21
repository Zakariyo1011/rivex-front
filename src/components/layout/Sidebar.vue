<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'
import Avatar from '@/components/ui/Avatar.vue'
import NotificationBell from '@/components/layout/NotificationBell.vue'
import { mainNavItems } from '@/lib/nav'
import { icons } from '@/lib/icons'

const route = useRoute()
const { t } = useI18n()
const auth = useAuthStore()

// Same store as BottomNav, so the two breakpoints cannot disagree about how
// many unread messages there are.
const chat = useChatStore()
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
      <!-- Notifications sit with the rest of the navigation rather than
           floating over the page. See AppLayout for what this replaces. -->
      <NotificationBell variant="nav" />

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

        <!-- The unread count, on desktop, where it simply did not exist: the
             bottom nav has carried this badge since the chat list was built and
             the sidebar never grew one, so the same account showed an unread
             count on a phone and nothing at all on a laptop.

             Two positions on purpose. Collapsed (tablet) the label is hidden
             and the badge pins to the icon; expanded (desktop) it sits at the
             end of the row, where a count belongs beside a name rather than on
             top of a picture. -->
        <template v-if="item.name === 'chats' && chat.totalUnread > 0">
          <span
            class="desktop:hidden absolute top-1.5 right-1.5 min-w-[1.05rem] h-[1.05rem] px-1 rounded-full bg-primary-600 text-white text-[10px] font-semibold flex items-center justify-center"
            :aria-label="`${chat.totalUnread} o‘qilmagan xabar`"
          >
            {{ chat.totalUnread > 99 ? '99+' : chat.totalUnread }}
          </span>
          <span
            class="hidden desktop:flex ml-auto min-w-[1.25rem] h-5 px-1.5 rounded-full bg-primary-600 text-white text-[11px] font-semibold items-center justify-center"
            :aria-label="`${chat.totalUnread} o‘qilmagan xabar`"
          >
            {{ chat.totalUnread > 99 ? '99+' : chat.totalUnread }}
          </span>
        </template>
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
