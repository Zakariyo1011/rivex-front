<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import Rating from '@/components/ui/Rating.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { activityStatus } from '@/lib/statusLabels'
import { categoryIcon, icons } from '@/lib/icons'
import { formatActivityStart, formatMoney, formatNumber, formatTime } from '@/lib/datetime'
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
      return 'Bepul'
    case 'shared_cost':
      return 'Umumiy xarajat'
    case 'owner_pays':
      return "Sherikka to'lanadi"
    case 'participant_pays':
      return "Siz to'laysiz"
    default:
      return ''
  }
})

const isFree = computed(() => props.activity.payment_type === 'free')

/**
 * "Chilonzor, Toshkent" when the activity carries a region, otherwise just the
 * meeting-point name the organiser typed. This is always the *activity's*
 * location — never the organiser's home, which is private.
 */
const locationLabel = computed(() => {
  const region = props.activity.location?.region?.name
  const name = props.activity.location_name

  return region && !name.includes(region) ? `${name}, ${region}` : name
})

/** Present only when the search was geo-anchored, so it may legitimately be absent. */
const distanceLabel = computed(() => {
  const km = props.activity.distance_km
  if (km === undefined || km === null) return null

  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
})

/**
 * "Ertaga, 18:00 — 20:00".
 *
 * The card used to show only the start, which answers "when do I turn up" and
 * not "am I free". The end costs six characters and removes the tap that used
 * to be needed to find out. Same range, same order and same em dash as the
 * detail page, so the two never read as different facts.
 */
const startLabel = computed(
  () =>
    `${formatActivityStart(props.activity.start_at)} — ${formatTime(props.activity.ends_at)}`,
)

/**
 * Whether this card should say what state the activity is in.
 *
 * 🔴 It never did. `ActivityRow` — the list row on My Activities — has carried a
 * status badge since it was written, but this card, which is what Home, Explore
 * and every grid render, had none at all. A completed or cancelled activity was
 * pixel-identical to one still open, which is the "completed does not show"
 * complaint: it does show, on one of the two components that render an
 * activity.
 *
 * `published` is the ordinary case and stays unlabelled — a badge on every card
 * in Explore would be noise that teaches people to stop reading badges.
 */
const showStatus = computed(() => props.activity.status !== 'published')

/** Present only when the search was geo-anchored, and honest about precision. */
const distancePrefix = computed(() => (props.activity.distance_approximate ? '~' : ''))

function open() {
  router.push({ name: 'activity-detail', params: { id: props.activity.id } })
}
</script>

<template>
  <div v-if="compact" class="card card-hover w-[180px] shrink-0 p-3 cursor-pointer" @click="open">
    <div class="flex items-center justify-between mb-2">
      <span
        class="w-9 h-9 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center"
      >
        <FontAwesomeIcon :icon="categoryIcon(activity.category.slug)" class="text-sm" />
      </span>
      <span
        v-if="!isFree"
        class="text-[11px] font-semibold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full"
      >
        {{ formatNumber(activity.amount) }}
      </span>
    </div>
    <p class="font-semibold text-sm text-ink truncate">{{ activity.title }}</p>
    <StatusBadge
      v-if="showStatus"
      :status="activity.status"
      :labels="activityStatus.labels"
      :variants="activityStatus.variants"
      class="mt-1"
    />
    <p class="text-xs text-ink-faint mt-0.5">{{ startLabel }}</p>
    <p class="text-xs text-ink-faint">{{ activity.people_needed }} kishi kerak</p>
    <div class="flex items-center gap-1.5 mt-2">
      <div
        class="w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-[10px] flex items-center justify-center font-semibold overflow-hidden"
      >
        <img
          v-if="activity.owner.profile.avatar_url"
          :src="activity.owner.profile.avatar_url"
          class="w-full h-full object-cover"
        />
        <span v-else>{{ activity.owner.name[0] }}</span>
      </div>
      <span class="text-xs text-ink-muted truncate">{{ activity.owner.name }}</span>
    </div>
  </div>

  <div v-else class="card card-hover p-4 cursor-pointer" @click="open">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="font-semibold text-ink flex items-center gap-1.5">
          <span
            class="w-6 h-6 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center shrink-0"
          >
            <FontAwesomeIcon :icon="categoryIcon(activity.category.slug)" class="text-[11px]" />
          </span>
          {{ activity.title }}
        </p>
        <p class="text-sm text-ink-faint mt-1">{{ startLabel }}</p>
        <p class="text-sm text-ink-faint flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
          <span class="flex items-center gap-1 min-w-0">
            <FontAwesomeIcon :icon="icons.location" class="text-[11px] shrink-0" />
            <span class="truncate">{{ locationLabel }}</span>
          </span>
          <!-- Distance only exists when the search was geo-anchored. -->
          <span
            v-if="distanceLabel"
            class="flex items-center gap-1 text-primary-600 font-medium shrink-0"
          >
            <FontAwesomeIcon :icon="icons.locateMe" class="text-[10px]" />
            {{ distancePrefix }}{{ distanceLabel }}
          </span>
        </p>
      </div>
      <div class="shrink-0 flex flex-col items-end gap-1.5">
        <StatusBadge
          v-if="showStatus"
          :status="activity.status"
          :labels="activityStatus.labels"
          :variants="activityStatus.variants"
        />
        <span
          class="text-[11px] font-semibold bg-primary-50 text-primary-700 px-2.5 py-1 rounded-full flex items-center gap-1"
        >
          <FontAwesomeIcon :icon="icons.people" class="text-[10px]" />
          {{ activity.people_needed }} kishi
        </span>
      </div>
    </div>

    <div
      class="mt-3 rounded-xl px-3 py-2 flex items-center justify-between"
      :class="isFree ? 'bg-surface-muted' : 'bg-primary-50'"
    >
      <div>
        <p class="font-semibold" :class="isFree ? 'text-ink-secondary' : 'text-primary-700'">
          {{ isFree ? 'Bepul' : formatMoney(activity.amount) }}
        </p>
        <p v-if="!isFree" class="text-xs text-primary-500">{{ paymentLabel }}</p>
      </div>
    </div>

    <div class="flex items-center justify-between mt-3">
      <div class="flex items-center gap-2">
        <div
          class="w-7 h-7 rounded-full bg-primary-100 text-primary-700 text-xs flex items-center justify-center font-semibold overflow-hidden"
        >
          <img
            v-if="activity.owner.profile.avatar_url"
            :src="activity.owner.profile.avatar_url"
            class="w-full h-full object-cover"
          />
          <span v-else>{{ activity.owner.name[0] }}</span>
        </div>
        <span class="text-sm font-medium text-ink-secondary">{{ activity.owner.name }}</span>
        <FontAwesomeIcon
          v-if="activity.owner.identity_verified"
          :icon="icons.verified"
          class="text-primary-500 text-xs"
        />
      </div>
      <Rating v-if="activity.owner.rating_average" :value="activity.owner.rating_average" />
    </div>
  </div>
</template>
