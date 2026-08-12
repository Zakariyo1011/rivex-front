<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import ReportBlockMenu from '@/components/profile/ReportBlockMenu.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import VerificationBadge from '@/components/ui/VerificationBadge.vue'
import { profileApi } from '@/api/profile'
import { useAuthStore } from '@/stores/auth'
import { icons } from '@/lib/icons'
import type { User, Review } from '@/types'

const route = useRoute()
const auth = useAuthStore()
const user = ref<User | null>(null)
const reviews = ref<Review[]>([])
const loading = ref(true)
const hasError = ref(false)

async function load() {
  loading.value = true
  hasError.value = false
  try {
    const userId = Number(route.params.id)
    const [userRes, reviewsRes] = await Promise.all([
      profileApi.show(userId),
      profileApi.reviews(userId) as Promise<{ data: { data: Review[] } }>,
    ])
    user.value = userRes.data.data
    reviews.value = reviewsRes.data.data
  } catch {
    hasError.value = true
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <AppLayout>
    <div v-if="loading" class="px-4 md:px-8 pt-6 md:pt-8 max-w-xl pb-8">
      <div class="card p-6 text-center space-y-3">
        <Skeleton variant="circle" width="5rem" height="5rem" class="mx-auto" />
        <Skeleton variant="text" width="50%" class="mx-auto" />
        <Skeleton variant="text" width="35%" class="mx-auto" />
      </div>
    </div>

    <ErrorState v-else-if="hasError" @retry="load" />

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
          <VerificationBadge v-if="user.identity_verified" compact />
        </h1>
        <p v-if="user.profile.location_name" class="text-sm text-ink-muted flex items-center justify-center gap-1.5">
          <FontAwesomeIcon :icon="icons.location" class="text-ink-faint text-xs" /> {{ user.profile.location_name }}
        </p>

        <!-- Verification is a fact about the account; rating and trust score are
             judgements about behaviour. They are shown as separate signals on
             purpose — a verified newcomer is not the same as a trusted regular. -->
        <div class="flex items-center justify-center gap-2 mt-3 flex-wrap">
          <span
            v-if="user.identity_verified"
            class="inline-flex items-center gap-1.5 rounded-full bg-primary-50 text-primary-700 text-xs font-medium px-2.5 py-1"
          >
            <FontAwesomeIcon :icon="icons.identity" /> Shaxsi tasdiqlangan
          </span>
          <span
            v-if="user.phone_verified"
            class="inline-flex items-center gap-1.5 rounded-full bg-success-bg text-success text-xs font-medium px-2.5 py-1"
          >
            <FontAwesomeIcon :icon="icons.phone" /> Telefon tasdiqlangan
          </span>
        </div>

        <div class="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-border">
          <div>
            <p class="font-bold text-ink">{{ user.rating_average ?? '—' }}</p>
            <p class="text-xs text-ink-muted flex items-center justify-center gap-1">
              <FontAwesomeIcon :icon="icons.starSolid" class="text-star" /> Reyting
            </p>
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

        <div v-if="user.trust_score !== undefined" class="mt-4 pt-4 border-t border-border flex items-center justify-center gap-2">
          <span class="text-sm text-ink-muted flex items-center gap-1.5">
            <FontAwesomeIcon :icon="icons.trust" /> Trust score
          </span>
          <span class="text-sm font-bold text-primary-600">{{ user.trust_score }}%</span>
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
              <span class="text-star text-sm flex items-center gap-0.5">
                <FontAwesomeIcon v-for="n in review.rating ?? 0" :key="n" :icon="icons.starSolid" class="text-[0.85em]" />
              </span>
            </div>
            <p v-if="review.comment" class="text-sm text-ink-muted">{{ review.comment }}</p>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>
