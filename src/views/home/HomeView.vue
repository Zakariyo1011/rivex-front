<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import ActivityCard from '@/components/activity/ActivityCard.vue'
import VerificationBanner from '@/components/verification/VerificationBanner.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import { useAuthStore } from '@/stores/auth'
import { activitiesApi } from '@/api/activities'
import { categoriesApi } from '@/api/categories'
import { categoryIcon, icons } from '@/lib/icons'
import type { Activity, Category } from '@/types'

const router = useRouter()
const auth = useAuthStore()

const activities = ref<Activity[]>([])
const categories = ref<Category[]>([])
const loading = ref(true)
const hasError = ref(false)
const search = ref('')

const greeting = () => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Xayrli tong'
  if (hour < 18) return 'Xayrli kun'
  return 'Xayrli kech'
}

async function load() {
  loading.value = true
  hasError.value = false
  try {
    const [activitiesRes, categoriesRes] = await Promise.all([
      activitiesApi.list({ sort: 'newest' }),
      categoriesApi.list(),
    ])
    activities.value = activitiesRes.data.data
    categories.value = categoriesRes.data.data
  } catch {
    hasError.value = true
  } finally {
    loading.value = false
  }
}

function goSearch() {
  router.push({ name: 'explore', query: search.value ? { q: search.value } : {} })
}

onMounted(load)
</script>

<template>
  <AppLayout>
    <div class="px-4 md:px-8 pt-6 md:pt-8">
      <div class="flex items-center justify-between mb-5 pr-14 md:pr-0">
        <div>
          <p class="text-ink-faint text-sm">{{ greeting() }} 👋</p>
          <h1 class="text-xl font-bold text-ink">{{ auth.user?.name }}</h1>
        </div>
        <RouterLink
          :to="{ name: 'profile' }"
          class="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold overflow-hidden md:hidden"
        >
          <img v-if="auth.user?.profile.avatar_url" :src="auth.user.profile.avatar_url" class="w-full h-full object-cover" />
          <span v-else>{{ auth.user?.name?.[0] }}</span>
        </RouterLink>
      </div>

      <VerificationBanner class="mb-5" />

      <button
        class="w-full h-12 rounded-xl bg-surface border-2 border-primary-200 shadow-sm px-4 flex items-center gap-2.5 text-left text-ink-faint mb-6 hover:border-primary-400 hover:shadow-md transition"
        @click="goSearch"
      >
        <FontAwesomeIcon :icon="icons.explore" class="text-primary-500" />
        Nima qilmoqchisiz?
      </button>

      <div class="flex gap-3 overflow-x-auto pb-2 mb-7 -mx-4 px-4 md:mx-0 md:px-0">
        <button
          v-for="category in categories"
          :key="category.id"
          class="flex flex-col items-center gap-1.5 shrink-0"
          @click="router.push({ name: 'explore', query: { category_id: category.id } })"
        >
          <span
            class="w-14 h-14 rounded-2xl bg-surface border-2 border-primary-200 flex items-center justify-center text-lg text-primary-600 shadow-sm hover:border-primary-400 hover:shadow-md transition"
          >
            <FontAwesomeIcon :icon="categoryIcon(category.slug)" />
          </span>
          <span class="text-xs text-ink-muted font-medium">{{ category.name }}</span>
        </button>
      </div>

      <div class="flex items-center justify-between mb-3">
        <h2 class="font-bold text-ink">Yaqinda qo'shilgan</h2>
        <RouterLink :to="{ name: 'explore' }" class="text-sm text-primary-600 font-medium">Barchasi</RouterLink>
      </div>

      <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
      <ErrorState v-else-if="hasError" @retry="load" />
      <EmptyState
        v-else-if="activities.length === 0"
        :icon="icons.explore"
        title="Hozircha faoliyatlar yo'q"
        description="Birinchi bo'lib faoliyat yarating va sherik toping."
      />
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <ActivityCard v-for="activity in activities" :key="activity.id" :activity="activity" />
      </div>
    </div>
  </AppLayout>
</template>
