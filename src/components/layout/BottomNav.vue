<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { bottomNavItems } from '@/lib/nav'
import { useChatStore } from '@/stores/chat'

const route = useRoute()
const { t } = useI18n()

// Read from the store rather than fetched here: the count is already kept in
// step by the chat list and by every incoming message, and a second source
// would be a badge that disagrees with the screen it points at.
const chat = useChatStore()

</script>

<template>
  <nav
    class="tablet:hidden fixed bottom-0 inset-x-0 bg-surface border-t border-border flex items-center justify-around h-[64px] px-2 z-40"
    style="padding-bottom: env(safe-area-inset-bottom)"
  >
    <RouterLink
      v-for="item in bottomNavItems"
      :key="item.name"
      :to="{ name: item.name }"
      class="flex flex-col items-center justify-center gap-1 flex-1 h-full"
    >
      <span
        v-if="item.action"
        class="w-12 h-12 rounded-full bg-primary-600 text-white flex items-center justify-center text-xl -mt-6 shadow-lg shadow-primary-600/30"
      >
        <FontAwesomeIcon :icon="item.icon" />
      </span>
      <template v-else>
        <span class="relative">
          <FontAwesomeIcon
            :icon="item.icon"
            class="text-lg"
            :class="route.name === item.name ? 'text-primary-600' : 'text-ink-faint'"
          />
          <span
            v-if="item.name === 'chats' && chat.totalUnread > 0"
            class="absolute -top-1.5 -right-2.5 min-w-[1.05rem] h-[1.05rem] px-1 rounded-full bg-primary-600 text-white text-[10px] font-semibold flex items-center justify-center"
            :aria-label="`${chat.totalUnread} o‘qilmagan xabar`"
          >
            {{ chat.totalUnread > 99 ? '99+' : chat.totalUnread }}
          </span>
        </span>
        <span class="text-[11px] font-medium" :class="route.name === item.name ? 'text-primary-600' : 'text-ink-faint'">
          {{ t(item.labelKey) }}
        </span>
      </template>
    </RouterLink>
  </nav>
</template>
