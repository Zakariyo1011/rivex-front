<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { icons } from '@/lib/icons'

const route = useRoute()
const { t } = useI18n()

const items = [
  { name: 'home', labelKey: 'nav.home', icon: icons.home },
  // Global search is the discovery entry on mobile; Explore stays reachable
  // from the desktop sidebar and from Home. Six items plus the create button
  // does not fit at 375px, and search is the broader of the two.
  { name: 'search', labelKey: 'nav.search', icon: icons.explore },
  { name: 'activity-create', labelKey: '', icon: icons.add },
  { name: 'chats', labelKey: 'nav.chats', icon: icons.chat },
  { name: 'profile', labelKey: 'nav.profile', icon: icons.profile },
]
</script>

<template>
  <nav
    class="tablet:hidden fixed bottom-0 inset-x-0 bg-surface border-t border-border flex items-center justify-around h-[64px] px-2 z-40"
    style="padding-bottom: env(safe-area-inset-bottom)"
  >
    <RouterLink
      v-for="item in items"
      :key="item.name"
      :to="{ name: item.name }"
      class="flex flex-col items-center justify-center gap-1 flex-1 h-full"
    >
      <span
        v-if="item.name === 'activity-create'"
        class="w-12 h-12 rounded-full bg-primary-600 text-white flex items-center justify-center text-xl -mt-6 shadow-lg shadow-primary-600/30"
      >
        <FontAwesomeIcon :icon="item.icon" />
      </span>
      <template v-else>
        <FontAwesomeIcon
          :icon="item.icon"
          class="text-lg"
          :class="route.name === item.name ? 'text-primary-600' : 'text-ink-faint'"
        />
        <span class="text-[11px] font-medium" :class="route.name === item.name ? 'text-primary-600' : 'text-ink-faint'">
          {{ t(item.labelKey) }}
        </span>
      </template>
    </RouterLink>
  </nav>
</template>
