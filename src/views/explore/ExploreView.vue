<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import ActivityCard from '@/components/activity/ActivityCard.vue'
import AppSearchInput from '@/components/ui/AppSearchInput.vue'
import FilterChip from '@/components/ui/FilterChip.vue'
import CategoryChip from '@/components/ui/CategoryChip.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { activitiesApi, type ActivityFilters } from '@/api/activities'
import { categoriesApi } from '@/api/categories'
import { locationsApi } from '@/api/locations'
import { icons } from '@/lib/icons'
import type { Activity, Category, Region } from '@/types'

const route = useRoute()

const activities = ref<Activity[]>([])
const categories = ref<Category[]>([])
const regions = ref<Region[]>([])
const loading = ref(true)
const hasError = ref(false)
const search = ref((route.query.q as string) ?? '')

type Tab = 'all' | 'nearby' | 'today' | 'free' | 'paid'
const activeTab = ref<Tab>('all')

const filters = reactive<ActivityFilters>({
  category_id: route.query.category_id ? Number(route.query.category_id) : undefined,
})

async function loadCategories() {
  const { data } = await categoriesApi.list()
  categories.value = data.data
}

async function loadRegions() {
  const { data } = await locationsApi.regions()
  regions.value = data.data
}

function selectRegion(id: number | undefined) {
  filters.region_id = filters.region_id === id ? undefined : id
  loadActivities()
}

async function loadActivities() {
  loading.value = true
  hasError.value = false
  const params: ActivityFilters = { ...filters, q: search.value || undefined }

  if (activeTab.value === 'today') params.date = 'today'
  if (activeTab.value === 'free') params.payment = 'free'
  if (activeTab.value === 'paid') params.payment = 'paid'
  if (activeTab.value === 'nearby') {
    params.sort = 'nearest'
    await new Promise<void>((resolve) => {
      if (!navigator.geolocation) return resolve()
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          params.lat = pos.coords.latitude
          params.lng = pos.coords.longitude
          resolve()
        },
        () => resolve(),
        { timeout: 3000 },
      )
    })

    if (!params.lat && !params.region_id) {
      try {
        const { data } = await locationsApi.me()
        if (data.data.region) params.region_id = data.data.region.id
        if (data.data.district) params.district_id = data.data.district.id
      } catch {
        // saqlangan joylashuv yo'q — filtrsiz davom etadi
      }
    }
  }

  try {
    const { data } = await activitiesApi.list(params)
    activities.value = data.data
  } catch {
    hasError.value = true
  } finally {
    loading.value = false
  }
}

function selectTab(tab: Tab) {
  activeTab.value = tab
  loadActivities()
}

function toggleCategory(id: number) {
  filters.category_id = filters.category_id === id ? undefined : id
  loadActivities()
}

let searchTimeout: ReturnType<typeof setTimeout>
watch(search, () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(loadActivities, 350)
})

onMounted(() => {
  loadCategories()
  loadRegions()
  loadActivities()
})

const tabs: { key: Tab; label: string }[] = [
  { key: 'all', label: 'Barchasi' },
  { key: 'nearby', label: 'Yaqin' },
  { key: 'today', label: 'Bugun' },
  { key: 'free', label: 'Bepul' },
  { key: 'paid', label: 'Pullik' },
]
</script>

<template>
  <AppLayout>
    <div class="px-4 md:px-8 pt-6 md:pt-8">
      <h1 class="text-xl font-bold text-ink mb-4">Qidiruv</h1>

      <AppSearchInput v-model="search" placeholder="Faoliyat qidirish..." class="mb-4" />

      <div class="flex gap-2 overflow-x-auto pb-1 mb-4 -mx-4 px-4 md:mx-0 md:px-0">
        <FilterChip
          v-for="tab in tabs"
          :key="tab.key"
          :active="activeTab === tab.key"
          @click="selectTab(tab.key)"
        >
          {{ tab.label }}
        </FilterChip>
      </div>

      <div class="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-4 px-4 md:mx-0 md:px-0">
        <button
          v-for="region in regions"
          :key="region.id"
          class="shrink-0 h-8 px-3 rounded-full text-xs font-medium transition flex items-center gap-1.5"
          :class="
            filters.region_id === region.id
              ? 'bg-primary-100 text-primary-700'
              : 'bg-surface-muted text-ink-muted'
          "
          @click="selectRegion(region.id)"
        >
          <FontAwesomeIcon :icon="icons.location" class="text-[10px]" />
          {{ region.name }}
        </button>
      </div>

      <div class="flex gap-2 overflow-x-auto pb-2 mb-5 -mx-4 px-4 md:mx-0 md:px-0">
        <CategoryChip
          v-for="category in categories"
          :key="category.id"
          :slug="category.slug"
          :label="category.name"
          :active="filters.category_id === category.id"
          @click="toggleCategory(category.id)"
        />
      </div>

      <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
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
      <EmptyState
        v-else-if="activities.length === 0"
        :icon="icons.explore"
        title="Hech narsa topilmadi"
        description="Boshqa kalit so'z yoki filtrlarni sinab ko'ring."
      />
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
        <ActivityCard v-for="activity in activities" :key="activity.id" :activity="activity" />
      </div>
    </div>
  </AppLayout>
</template>
