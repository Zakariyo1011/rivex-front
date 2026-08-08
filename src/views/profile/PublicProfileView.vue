<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import ReportBlockMenu from '@/components/profile/ReportBlockMenu.vue'
import { profileApi } from '@/api/profile'
import { useAuthStore } from '@/stores/auth'
import type { User, Review } from '@/types'

const route = useRoute()
const auth = useAuthStore()
const user = ref<User | null>(null)
const reviews = ref<Review[]>([])
const loading = ref(true)

onMounted(async () => {
  const userId = Number(route.params.id)
  const [userRes, reviewsRes] = await Promise.all([
    profileApi.show(userId),
    profileApi.reviews(userId) as Promise<{ data: { data: Review[] } }>,
  ])
  user.value = userRes.data.data
  reviews.value = reviewsRes.data.data
  loading.value = false
})
</script>

<template>
  <AppLayout>
    <div v-if="loading" class="p-8 text-center text-ink-faint">Yuklanmoqda...</div>

    <div v-else-if="user" class="px-4 md:px-8 pt-6 md:pt-8 max-w-xl pb-8">
      <div class="card p-6 text-center relative">
        <div v-if="user.id !== auth.user?.id" class="absolute top-4 right-4">
          <ReportBlockMenu :user-id="user.id" :user-name="user.name" />
        </div>

        <div class="w-20 h-20 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-2xl font-semibold overflow-hidden mx-auto">
          <img v-if="user.profile.avatar_url" :src="user.profile.avatar_url" class="w-full h-full object-cover" />
          <span v-else>{{ user.name[0] }}</span>
        </div>
        <h1 class="text-lg font-bold text-ink mt-3 flex items-center justify-center gap-1.5">
          {{ user.name }}
          <span v-if="user.identity_verified" class="text-primary-500 text-sm">✓ Tasdiqlangan</span>
        </h1>
        <p v-if="user.profile.location_name" class="text-sm text-ink-muted">📍 {{ user.profile.location_name }}</p>

        <div class="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-border">
          <div>
            <p class="font-bold text-ink">{{ user.rating_average ?? '—' }}</p>
            <p class="text-xs text-ink-muted">⭐ Reyting</p>
          </div>
          <div>
            <p class="font-bold text-ink">{{ user.completed_activities_count ?? 0 }}</p>
            <p class="text-xs text-ink-muted">Yakunlangan</p>
          </div>
          <div>
            <p class="font-bold text-ink">{{ user.reviews_count ?? 0 }}</p>
            <p class="text-xs text-ink-muted">Sharhlar</p>
          </div>
        </div>

        <p v-if="user.profile.bio" class="text-sm text-ink-secondary mt-4">{{ user.profile.bio }}</p>
      </div>

      <div class="mt-5">
        <h2 class="font-semibold text-ink mb-3">Sharhlar</h2>
        <p v-if="reviews.length === 0" class="text-sm text-ink-faint">Hozircha sharhlar yo'q.</p>
        <div v-else class="space-y-3">
          <div v-for="review in reviews" :key="review.id" class="card p-4">
            <div class="flex items-center gap-2 mb-1.5">
              <span class="font-medium text-ink text-sm">{{ review.reviewer.name }}</span>
              <span class="text-star text-sm">{{ '⭐'.repeat(review.rating ?? 0) }}</span>
            </div>
            <p v-if="review.comment" class="text-sm text-ink-muted">{{ review.comment }}</p>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>
