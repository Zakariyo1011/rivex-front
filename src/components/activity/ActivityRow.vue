<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { categoryIcon, icons } from '@/lib/icons'
import { formatActivityStart, formatTime } from '@/lib/datetime'
import { activityStatus } from '@/lib/statusLabels'
import type { Activity } from '@/types'

/**
 * One activity, as a list row.
 *
 * The same markup was written out twice — in the Applications screen and again
 * wherever a list of activities was needed — each with its **own local copy of
 * the status label map**, even though `lib/statusLabels` has held the canonical
 * one since the admin list and the detail page disagreed about it. One row, one
 * map.
 *
 * `role` says how the viewer relates to this activity, which is the only thing
 * that differs between the lists that use it: an organiser needs to see who is
 * waiting, a participant does not.
 */
const props = defineProps<{
  activity: Activity
  role?: 'owner' | 'participant'
}>()

const pending = computed(() =>
  props.role === 'owner' ? (props.activity.pending_applications_count ?? 0) : 0,
)
</script>

<template>
  <div class="card card-hover">
    <RouterLink
      :to="{ name: 'activity-detail', params: { id: activity.id } }"
      class="p-4 flex items-start gap-3"
    >
      <span
        class="w-9 h-9 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center shrink-0"
      >
        <FontAwesomeIcon :icon="categoryIcon(activity.category.slug)" class="text-sm" />
      </span>

      <div class="min-w-0 flex-1">
        <p class="font-semibold text-ink truncate">{{ activity.title }}</p>
        <p class="text-sm text-ink-muted truncate">
          {{ formatActivityStart(activity.start_at) }} — {{ formatTime(activity.ends_at) }}
          <template v-if="activity.location_name"> · {{ activity.location_name }}</template>
        </p>

        <!-- Says which of the two lists this row is standing in, since "all"
             mixes them and the status badge alone cannot tell you whether you
             organised something or merely turned up to it. -->
        <p v-if="role" class="text-xs text-ink-faint mt-0.5">
          {{ role === 'owner' ? 'Siz tashkilotchisiz' : 'Siz ishtirokchisiz' }}
        </p>
      </div>

      <StatusBadge
        :status="activity.status"
        :labels="activityStatus.labels"
        :variants="activityStatus.variants"
        class="shrink-0"
      />
    </RouterLink>

    <!-- The organiser's cue to act. Only rendered when the server sent a count,
         which it does only for activities the caller owns. -->
    <RouterLink
      v-if="pending > 0"
      :to="{ name: 'incoming-applications', params: { id: activity.id } }"
      class="flex items-center justify-between gap-2 px-4 py-3 border-t border-border text-sm font-medium text-primary-700 hover:bg-primary-50/60 transition-colors rounded-b-2xl"
    >
      <span class="flex items-center gap-2 min-w-0">
        <FontAwesomeIcon :icon="icons.applications" class="text-xs shrink-0" />
        <span class="truncate">{{ pending }} ta yangi ariza</span>
      </span>
      <FontAwesomeIcon :icon="icons.chevronRight" class="text-xs shrink-0" />
    </RouterLink>
  </div>
</template>
