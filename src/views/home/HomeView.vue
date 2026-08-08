<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import ActivityCard from '@/components/activity/ActivityCard.vue'
import { useAuthStore } from '@/stores/auth'
import { activitiesApi } from '@/api/activities'
import { categoriesApi } from '@/api/categories'
import type { Activity, Category } from '@/types'

const router = useRouter()
const auth = useAuthStore()

const activities = ref<Activity[]>([])
const categories = ref<Category[]>([])
const loading = ref(true)
const search = ref('')

const greeting = () => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Xayrli tong'
  if (hour < 18) return 'Xayrli kun'
  return 'Xayrli kech'
}

async function load() {
  loading.value = true
  const [activitiesRes, categoriesRes] = await Promise.all([
    activitiesApi.list({ sort: 'newest' }),
    categoriesApi.list(),
  ])
  activities.value = activitiesRes.data.data
  categories.value = categoriesRes.data.data
  loading.value = false
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
          <p class="text-gray-400 text-sm">{{ greeting() }} 👋</p>
          <h1 class="text-xl font-bold text-gray-900">{{ auth.user?.name }}</h1>
        </div>
        <RouterLink
          :to="{ name: 'profile' }"
          class="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold overflow-hidden md:hidden"
        >
          <img v-if="auth.user?.profile.avatar_url" :src="auth.user.profile.avatar_url" class="w-full h-full object-cover" />
          <span v-else>{{ auth.user?.name?.[0] }}</span>
        </RouterLink>
      </div>

      <button
        class="w-full h-12 rounded-xl bg-white border border-gray-200 px-4 flex items-center gap-2.5 text-left text-gray-400 mb-6"
        @click="goSearch"
      >
        🔍 Nima qilmoqchisiz?
      </button>

      <div class="flex gap-3 overflow-x-auto pb-2 mb-7 -mx-4 px-4 md:mx-0 md:px-0">
        <button
          v-for="category in categories"
          :key="category.id"
          class="flex flex-col items-center gap-1.5 shrink-0"
          @click="router.push({ name: 'explore', query: { category_id: category.id } })"
        >
          <span class="w-14 h-14 rounded-2xl bg-white border border-gray-100 flex items-center justify-center text-2xl shadow-sm">
            {{ category.icon }}
          </span>
          <span class="text-xs text-gray-500 font-medium">{{ category.name }}</span>
        </button>
      </div>

      <div class="flex items-center justify-between mb-3">
        <h2 class="font-bold text-gray-900">Yaqinda qo'shilgan</h2>
        <RouterLink :to="{ name: 'explore' }" class="text-sm text-primary-600 font-medium">Barchasi</RouterLink>
      </div>

      <div v-if="loading" class="text-gray-400 text-sm py-8 text-center">Yuklanmoqda...</div>
      <div v-else-if="activities.length === 0" class="text-gray-400 text-sm py-8 text-center">
        Hozircha faoliyatlar yo'q. Birinchi bo'lib yarating!
      </div>
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <ActivityCard v-for="activity in activities" :key="activity.id" :activity="activity" />
      </div>
    </div>
  </AppLayout>
</template>
