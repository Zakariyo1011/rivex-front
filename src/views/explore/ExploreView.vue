<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import ActivityCard from '@/components/activity/ActivityCard.vue'
import AppSearchInput from '@/components/ui/AppSearchInput.vue'
import CategoryChip from '@/components/ui/CategoryChip.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import AppButton from '@/components/ui/AppButton.vue'
import LocationFilterChips, { type LocationScope } from '@/components/explore/LocationFilterChips.vue'
import ExploreFilterSheet, { type ExploreFilters } from '@/components/explore/ExploreFilterSheet.vue'
import { activitiesApi, type ActivityFilters } from '@/api/activities'
import { categoriesApi } from '@/api/categories'
import { locationsApi } from '@/api/locations'
import { useGeolocation } from '@/composables/useGeolocation'
import { icons } from '@/lib/icons'
import type { Activity, Category, Region, UserLocation } from '@/types'

const route = useRoute()
const geo = useGeolocation()

const activities = ref<Activity[]>([])
const categories = ref<Category[]>([])
const regions = ref<Region[]>([])
const userLocation = ref<UserLocation | null>(null)
const loading = ref(true)
const hasError = ref(false)
const locating = ref(false)
const showFilters = ref(false)

const search = ref((route.query.q as string) ?? '')
const categoryId = ref<number | null>(route.query.category_id ? Number(route.query.category_id) : null)
const scope = ref<LocationScope>('all')
const radiusKm = ref(5)

const filters = reactive<ExploreFilters>({
  date: null,
  time_of_day: null,
  payment: null,
  people_needed: null,
  min_amount: null,
  max_amount: null,
  verified_only: false,
  region_id: null,
  sort: 'newest',
})

/** Drives the "N" badge on the Filtrlar button. */
const activeFilterCount = computed(() => {
  let count = 0
  if (filters.date) count++
  if (filters.time_of_day) count++
  if (filters.payment) count++
  if (filters.people_needed) count++
  if (filters.min_amount !== null || filters.max_amount !== null) count++
  if (filters.verified_only) count++
  if (filters.region_id) count++
  if (filters.sort !== 'newest') count++
  return count
})

const hasAnyFilter = computed(
  () => activeFilterCount.value > 0 || !!categoryId.value || scope.value !== 'all' || !!search.value,
)

/** GPS was asked for and refused — Explore keeps working on region instead. */
const showLocationPrompt = computed(() => scope.value === 'near_me' && geo.isDenied.value)

function buildParams(): ActivityFilters {
  const params: ActivityFilters = {
    q: search.value || undefined,
    category_id: categoryId.value ?? undefined,
    date: filters.date ?? undefined,
    time_of_day: filters.time_of_day ?? undefined,
    payment: filters.payment ?? undefined,
    people_needed: filters.people_needed ?? undefined,
    min_amount: filters.min_amount ?? undefined,
    max_amount: filters.max_amount ?? undefined,
    verified_only: filters.verified_only || undefined,
    region_id: filters.region_id ?? undefined,
    sort: filters.sort,
  }

  if (scope.value === 'near_me' && geo.coords.value) {
    params.lat = geo.coords.value.lat
    params.lng = geo.coords.value.lng
    params.radius_km = radiusKm.value
    // Distance is the whole point of this scope, so lead with it unless the
    // user has explicitly chosen another ordering.
    if (filters.sort === 'newest') params.sort = 'nearest'
  }

  // Explicit region/district beats the saved one from onboarding.
  if (scope.value === 'my_district' && userLocation.value?.district) {
    params.district_id = userLocation.value.district.id
  }

  if (scope.value === 'my_region' && userLocation.value?.region) {
    params.region_id = userLocation.value.region.id
  }

  return params
}

async function loadActivities() {
  loading.value = true
  hasError.value = false

  try {
    const { data } = await activitiesApi.list(buildParams())
    activities.value = data.data
  } catch {
    hasError.value = true
  } finally {
    loading.value = false
  }
}

async function selectScope(next: LocationScope) {
  scope.value = next

  // Ask for a fix only when the user actually chose "near me" — never on load.
  if (next === 'near_me' && !geo.coords.value) {
    locating.value = true
    await geo.request()
    locating.value = false
  }

  loadActivities()
}

async function enableLocation() {
  locating.value = true
  await geo.request()
  locating.value = false
  loadActivities()
}

/**
 * The root whose children are on show.
 *
 * Tracked separately from `categoryId` because selecting a child must not
 * collapse the row it was selected from — the drill-down stays open on the
 * parent while the filter moves to the child.
 */
const openRootId = ref<number | null>(null)

const openRoot = computed(() => categories.value.find((c) => c.id === openRootId.value) ?? null)

const subcategories = computed(() => openRoot.value?.children ?? [])

function toggleCategory(id: number) {
  const wasActive = categoryId.value === id || openRootId.value === id

  if (wasActive) {
    categoryId.value = null
    openRootId.value = null
  } else {
    categoryId.value = id
    openRootId.value = id
  }

  loadActivities()
}

/**
 * Narrow to a child, or step back up to the whole shelf.
 *
 * Tapping the active child returns the filter to its root rather than clearing
 * it — the row is already open on that root, so clearing entirely would leave
 * the interface showing a drill-down for a filter that no longer exists.
 */
function toggleSubcategory(id: number) {
  categoryId.value = categoryId.value === id ? openRootId.value : id
  loadActivities()
}

/**
 * Merge rather than replace: reassigning `filters` would swap out the proxy
 * that activeFilterCount tracks, and the badge would go stale.
 */
function applyFilters(next: ExploreFilters) {
  Object.assign(filters, next)
  loadActivities()
}

function clearAll() {
  search.value = ''
  categoryId.value = null
  openRootId.value = null
  scope.value = 'all'
  Object.assign(filters, {
    date: null,
    time_of_day: null,
    payment: null,
    people_needed: null,
    min_amount: null,
    max_amount: null,
    verified_only: false,
    region_id: null,
    sort: 'newest',
  })
  loadActivities()
}

let searchTimeout: ReturnType<typeof setTimeout>
watch(search, () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(loadActivities, 350)
})

onMounted(async () => {
  const [categoriesRes, regionsRes] = await Promise.all([
    // The tree, not the flat list: the chips render roots and the drill-down
    // needs their children without a second round trip on every tap.
    categoriesApi.tree().catch(() => null),
    locationsApi.regions().catch(() => null),
  ])

  if (categoriesRes) categories.value = categoriesRes.data.data
  if (regionsRes) regions.value = regionsRes.data.data

  // A link may arrive pointing at a subcategory (`?category_id=`). Open the
  // shelf it belongs to, so the drill-down reflects the filter that is already
  // applied instead of showing a closed row.
  if (categoryId.value !== null) {
    const root = categories.value.find(
      (c) => c.id === categoryId.value || c.children?.some((k) => k.id === categoryId.value),
    )
    openRootId.value = root?.id ?? null
  }

  // Saved onboarding location powers the "my district / my region" chips.
  try {
    const { data } = await locationsApi.me()
    userLocation.value = data.data
  } catch {
    // Not fatal — those chips simply do not appear.
  }

  loadActivities()
})
</script>

<template>
  <AppLayout>
    <template #header>
      <h1 class="text-lg font-bold text-ink truncate">Faoliyatlar</h1>
    </template>

    <div class="px-4 md:px-8 pt-6 md:pt-8 pb-4">
      <h1 class="hidden tablet:block text-xl font-bold text-ink mb-4">Faoliyatlar</h1>

      <div class="flex items-center gap-2.5 mb-4">
        <AppSearchInput
          v-model="search"
          placeholder="Qayerga borishni yoki nima qilishni xohlaysiz?"
          class="flex-1 min-w-0"
        />
        <button
          type="button"
          class="relative shrink-0 h-11 w-11 rounded-xl border border-border bg-surface text-ink-muted flex items-center justify-center hover:border-primary-300 hover:text-primary-600 transition"
          aria-label="Filtrlar"
          @click="showFilters = true"
        >
          <FontAwesomeIcon :icon="icons.filter" />
          <span
            v-if="activeFilterCount"
            class="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-primary-600 text-white text-[10px] font-bold flex items-center justify-center"
          >
            {{ activeFilterCount }}
          </span>
        </button>
      </div>

      <LocationFilterChips
        :scope="scope"
        :radius-km="radiusKm"
        :user-location="userLocation"
        :gps-denied="geo.isDenied.value"
        :locating="locating"
        class="mb-4"
        @update:scope="selectScope"
        @update:radius-km="((radiusKm = $event), loadActivities())"
      />

      <div class="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
        <CategoryChip
          v-for="category in categories"
          :key="category.id"
          :slug="category.slug"
          :label="category.name"
          :active="openRootId === category.id"
          @click="toggleCategory(category.id)"
        />
      </div>

      <!-- Subcategories, shown only once a shelf is open. A second row that is
           always present would be noise; one that appears on demand is a
           drill-down. Roots with no children (Coffee) simply never open one. -->
      <div
        v-if="subcategories.length"
        class="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0"
      >
        <button
          type="button"
          class="shrink-0 h-8 px-3 rounded-full text-xs font-medium transition"
          :class="
            categoryId === openRootId
              ? 'bg-primary-100 text-primary-700'
              : 'bg-surface-muted text-ink-muted hover:bg-border'
          "
          @click="toggleSubcategory(openRootId!)"
        >
          Hammasi
        </button>
        <button
          v-for="child in subcategories"
          :key="child.id"
          type="button"
          class="shrink-0 h-8 px-3 rounded-full text-xs font-medium transition"
          :class="
            categoryId === child.id
              ? 'bg-primary-100 text-primary-700'
              : 'bg-surface-muted text-ink-muted hover:bg-border'
          "
          @click="toggleSubcategory(child.id)"
        >
          {{ child.name }}
        </button>
      </div>

      <div class="mb-5" />

      <!-- GPS refused: say so once, offer the retry, and keep results flowing
           from the region filter rather than showing a dead end. -->
      <div
        v-if="showLocationPrompt"
        class="rounded-2xl border border-border bg-surface px-4 py-3.5 flex items-center gap-3.5 mb-5"
      >
        <span class="w-10 h-10 shrink-0 rounded-xl bg-surface-muted text-ink-muted flex items-center justify-center">
          <FontAwesomeIcon :icon="icons.locateMe" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="font-semibold text-ink text-sm">Joylashuv o'chirilgan</p>
          <p class="text-xs text-ink-muted mt-0.5">
            Yaqin faoliyatlarni ko'rish uchun brauzer sozlamalaridan joylashuvga ruxsat bering.
          </p>
        </div>
        <button
          type="button"
          class="shrink-0 h-9 px-4 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition"
          @click="enableLocation"
        >
          Yoqish
        </button>
      </div>

      <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <div v-for="i in 6" :key="i" class="card p-4 space-y-3">
          <div class="flex items-center justify-between">
            <Skeleton variant="circle" width="2rem" height="2rem" />
            <Skeleton variant="text" width="4rem" />
          </div>
          <Skeleton variant="text" width="70%" />
          <Skeleton variant="text" width="45%" />
          <Skeleton variant="block" height="2.75rem" />
        </div>
      </div>

      <ErrorState v-else-if="hasError" @retry="loadActivities" />

      <div v-else-if="activities.length === 0" class="text-center">
        <EmptyState
          :icon="icons.explore"
          :title="scope === 'near_me' ? 'Bu radiusda faoliyat topilmadi' : 'Bu hududda hozircha faoliyatlar topilmadi'"
          description="Radiusni kengaytiring yoki filtrlarni o'zgartirib ko'ring."
        />
        <div v-if="hasAnyFilter" class="max-w-xs mx-auto -mt-2">
          <AppButton variant="outline" @click="clearAll">Filtrlarni tozalash</AppButton>
        </div>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <ActivityCard v-for="activity in activities" :key="activity.id" :activity="activity" />
      </div>
    </div>

    <ExploreFilterSheet
      v-if="showFilters"
      :filters="filters"
      :regions="regions"
      @close="showFilters = false"
      @apply="applyFilters"
    />
  </AppLayout>
</template>
