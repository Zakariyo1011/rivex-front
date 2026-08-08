<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import ActivityCard from '@/components/activity/ActivityCard.vue'
import { activitiesApi, type ActivityFilters } from '@/api/activities'
import { categoriesApi } from '@/api/categories'
import type { Activity, Category } from '@/types'

const route = useRoute()

const activities = ref<Activity[]>([])
const categories = ref<Category[]>([])
const loading = ref(true)
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

async function loadActivities() {
  loading.value = true
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
  }

  try {
    const { data } = await activitiesApi.list(params)
    activities.value = data.data
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

      <div class="relative mb-4">
        <span class="absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint">🔍</span>
        <input
          v-model="search"
          type="text"
          placeholder="Faoliyat qidirish..."
          class="w-full h-12 rounded-xl bg-white border border-border pl-11 pr-4 text-[15px] outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-400"
        />
      </div>

      <div class="flex gap-2 overflow-x-auto pb-1 mb-4 -mx-4 px-4 md:mx-0 md:px-0">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="shrink-0 h-9 px-4 rounded-full text-sm font-medium transition"
          :class="
            activeTab === tab.key
              ? 'bg-primary-600 text-white'
              : 'bg-white text-ink-muted border border-border'
          "
          @click="selectTab(tab.key)"
        >
          {{ tab.label }}
        </button>
      </div>

      <div class="flex gap-2 overflow-x-auto pb-2 mb-5 -mx-4 px-4 md:mx-0 md:px-0">
        <button
          v-for="category in categories"
          :key="category.id"
          class="shrink-0 h-8 px-3 rounded-full text-xs font-medium transition flex items-center gap-1.5"
          :class="
            filters.category_id === category.id
              ? 'bg-primary-100 text-primary-700'
              : 'bg-surface-muted text-ink-muted'
          "
          @click="toggleCategory(category.id)"
        >
          {{ category.icon }} {{ category.name }}
        </button>
      </div>

      <div v-if="loading" class="text-ink-faint text-sm py-12 text-center">Yuklanmoqda...</div>
      <div v-else-if="activities.length === 0" class="text-ink-faint text-sm py-12 text-center">
        Hech narsa topilmadi.
      </div>
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
        <ActivityCard v-for="activity in activities" :key="activity.id" :activity="activity" />
      </div>
    </div>
  </AppLayout>
</template>
