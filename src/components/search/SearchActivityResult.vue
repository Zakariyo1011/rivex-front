<script setup lang="ts">
import { formatActivityStart } from '@/lib/datetime'
import { icons } from '@/lib/icons'
import type { Activity } from '@/types'

defineProps<{ activity: Activity }>()
</script>

<template>
  <li class="card p-3">
    <RouterLink
      :to="{ name: 'activity-detail', params: { id: String(activity.id) } }"
      class="block min-w-0"
    >
      <p class="font-medium text-ink truncate">{{ activity.title }}</p>

      <div class="flex items-center gap-3 mt-1 text-xs text-ink-muted flex-wrap">
        <span v-if="activity.category" class="text-primary-600">{{ activity.category.name }}</span>
        <span class="flex items-center gap-1">
          <FontAwesomeIcon :icon="icons.time" class="text-[0.6rem]" />
          {{ formatActivityStart(activity.start_at) }}
        </span>
        <span v-if="activity.location_name" class="flex items-center gap-1 truncate">
          <FontAwesomeIcon :icon="icons.location" class="text-[0.6rem]" />
          {{ activity.location_name }}
        </span>
      </div>
    </RouterLink>
  </li>
</template>
