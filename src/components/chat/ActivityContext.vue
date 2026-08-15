<script setup lang="ts">
import { ref } from 'vue'
import { categoryIcon, icons } from '@/lib/icons'
import { formatActivityStart } from '@/lib/datetime'
import type { Activity } from '@/types'

/**
 * "Activities together" — context on a direct conversation.
 *
 * This is the piece that lets one conversation carry four shared activities
 * instead of four conversations carrying one each. It is deliberately a strip
 * at the top of the thread rather than a title: the activities describe the
 * relationship, they do not identify the chat.
 *
 * Collapsed to the most recent one by default. A pair with eleven shared
 * activities should not have to scroll past all of them to reach their
 * messages.
 */
defineProps<{ activities: Activity[] }>()

const expanded = ref(false)
</script>

<template>
  <div v-if="activities.length" class="px-3 md:px-8 pt-3">
    <div class="rounded-2xl border border-border bg-surface overflow-hidden">
      <RouterLink
        v-for="activity in expanded ? activities : activities.slice(0, 1)"
        :key="activity.id"
        :to="{ name: 'activity-detail', params: { id: String(activity.id) } }"
        class="flex items-center gap-3 px-3.5 py-2.5 hover:bg-surface-muted transition-colors border-b border-border last:border-b-0"
      >
        <span
          class="w-8 h-8 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center shrink-0"
        >
          <FontAwesomeIcon :icon="categoryIcon(activity.category?.slug)" class="text-xs" />
        </span>

        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-ink truncate">{{ activity.title }}</p>
          <p class="text-xs text-ink-muted truncate">
            {{ formatActivityStart(activity.start_at) }}
            <template v-if="activity.location_name"> · {{ activity.location_name }}</template>
          </p>
        </div>

        <FontAwesomeIcon :icon="icons.chevronRight" class="text-ink-faint text-xs shrink-0" />
      </RouterLink>

      <button
        v-if="activities.length > 1"
        type="button"
        class="w-full px-3.5 py-2 text-xs font-medium text-primary-600 hover:bg-surface-muted transition-colors border-t border-border"
        @click="expanded = !expanded"
      >
        {{ expanded ? 'Yopish' : `Yana ${activities.length - 1} ta birgalikdagi faoliyat` }}
      </button>
    </div>
  </div>
</template>
