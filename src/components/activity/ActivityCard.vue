<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { categoryIcon, icons } from '@/lib/icons'
import type { Activity } from '@/types'

const props = withDefaults(
  defineProps<{
    activity: Activity
    compact?: boolean
  }>(),
  { compact: false },
)

const router = useRouter()

const paymentLabel = computed(() => {
  switch (props.activity.payment_type) {
    case 'free':
      return "Bepul"
    case 'shared_cost':
      return 'Umumiy xarajat'
    case 'owner_pays':
      return 'Sherikka to\'lanadi'
    case 'participant_pays':
      return "Siz to'laysiz"
    default:
      return ''
  }
})

const isFree = computed(() => props.activity.payment_type === 'free')

const startLabel = computed(() => {
  const date = new Date(props.activity.start_at)
  const today = new Date()
  const isToday = date.toDateString() === today.toDateString()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const isTomorrow = date.toDateString() === tomorrow.toDateString()

  const time = date.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })
  if (isToday) return `Bugun, ${time}`
  if (isTomorrow) return `Ertaga, ${time}`
  return `${date.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short' })}, ${time}`
})

function open() {
  router.push({ name: 'activity-detail', params: { id: props.activity.id } })
}
</script>

<template>
  <div
    v-if="compact"
    class="card card-hover w-[180px] shrink-0 p-3 cursor-pointer"
    @click="open"
  >
    <div class="flex items-center justify-between mb-2">
      <span class="w-9 h-9 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
        <FontAwesomeIcon :icon="categoryIcon(activity.category.slug)" class="text-sm" />
      </span>
      <span v-if="!isFree" class="text-[11px] font-semibold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full">
        {{ activity.amount.toLocaleString() }}
      </span>
    </div>
    <p class="font-semibold text-sm text-ink truncate">{{ activity.title }}</p>
    <p class="text-xs text-ink-faint mt-0.5">{{ startLabel }}</p>
    <p class="text-xs text-ink-faint">{{ activity.people_needed }} kishi kerak</p>
    <div class="flex items-center gap-1.5 mt-2">
      <div class="w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-[10px] flex items-center justify-center font-semibold overflow-hidden">
        <img v-if="activity.owner.profile.avatar_url" :src="activity.owner.profile.avatar_url" class="w-full h-full object-cover" />
        <span v-else>{{ activity.owner.name[0] }}</span>
      </div>
      <span class="text-xs text-ink-muted truncate">{{ activity.owner.name }}</span>
    </div>
  </div>

  <div v-else class="card card-hover p-4 cursor-pointer" @click="open">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="font-semibold text-ink flex items-center gap-1.5">
          <span class="w-6 h-6 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
            <FontAwesomeIcon :icon="categoryIcon(activity.category.slug)" class="text-[11px]" />
          </span>
          {{ activity.title }}
        </p>
        <p class="text-sm text-ink-faint mt-1">{{ startLabel }}</p>
        <p class="text-sm text-ink-faint flex items-center gap-1 mt-0.5">
          <FontAwesomeIcon :icon="icons.location" class="text-[11px]" />
          {{ activity.location_name }}
          <span v-if="activity.distance_km !== undefined">· {{ activity.distance_km }} km</span>
        </p>
      </div>
      <span class="shrink-0 text-[11px] font-semibold bg-primary-50 text-primary-700 px-2.5 py-1 rounded-full flex items-center gap-1">
        <FontAwesomeIcon :icon="icons.people" class="text-[10px]" />
        {{ activity.people_needed }} kishi
      </span>
    </div>

    <div
      class="mt-3 rounded-xl px-3 py-2 flex items-center justify-between"
      :class="isFree ? 'bg-surface-muted' : 'bg-primary-50'"
    >
      <div>
        <p class="font-semibold" :class="isFree ? 'text-ink-secondary' : 'text-primary-700'">
          {{ isFree ? 'Bepul' : `${activity.amount.toLocaleString()} UZS` }}
        </p>
        <p v-if="!isFree" class="text-xs text-primary-500">{{ paymentLabel }}</p>
      </div>
    </div>

    <div class="flex items-center justify-between mt-3">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-full bg-primary-100 text-primary-700 text-xs flex items-center justify-center font-semibold overflow-hidden">
          <img v-if="activity.owner.profile.avatar_url" :src="activity.owner.profile.avatar_url" class="w-full h-full object-cover" />
          <span v-else>{{ activity.owner.name[0] }}</span>
        </div>
        <span class="text-sm font-medium text-ink-secondary">{{ activity.owner.name }}</span>
        <FontAwesomeIcon v-if="activity.owner.identity_verified" :icon="icons.verified" class="text-primary-500 text-xs" />
      </div>
      <span v-if="activity.owner.rating_average" class="text-sm text-star font-medium flex items-center gap-1">
        <FontAwesomeIcon :icon="icons.starSolid" class="text-[0.85em]" />
        {{ activity.owner.rating_average }}
      </span>
    </div>
  </div>
</template>
