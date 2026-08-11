<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AppLayout from '@/layouts/AppLayout.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import Avatar from '@/components/ui/Avatar.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { matchesApi } from '@/api/matches'
import { useAuthStore } from '@/stores/auth'
import { categoryIcon, icons } from '@/lib/icons'
import type { ActivityMatch } from '@/types'

const auth = useAuthStore()
const matches = ref<ActivityMatch[]>([])
const loading = ref(true)
const hasError = ref(false)

function otherPerson(match: ActivityMatch) {
  if (match.activity.owner.id !== auth.user?.id) return match.activity.owner
  return match.participants.find((p) => p.id !== auth.user?.id) ?? match.activity.owner
}

async function load() {
  loading.value = true
  hasError.value = false
  try {
    const { data } = await matchesApi.list()
    matches.value = data.data
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
    <div class="px-4 md:px-8 pt-6 md:pt-8 max-w-2xl">
      <h1 class="text-xl font-bold text-ink mb-5">Suhbatlar</h1>

      <div v-if="loading" class="space-y-2">
        <div v-for="i in 4" :key="i" class="card p-4 flex items-center gap-3">
          <Skeleton variant="circle" width="3rem" height="3rem" />
          <div class="flex-1 space-y-2">
            <Skeleton variant="text" width="40%" />
            <Skeleton variant="text" width="65%" />
          </div>
        </div>
      </div>
      <ErrorState v-else-if="hasError" @retry="load" />
      <EmptyState
        v-else-if="matches.length === 0"
        :icon="icons.chat"
        title="Hozircha suhbatlaringiz yo'q"
        description="Ariza qabul qilinganda shu yerda paydo bo'ladi."
      />

      <div v-else class="space-y-2">
        <RouterLink
          v-for="match in matches"
          :key="match.id"
          :to="{ name: 'chat-detail', params: { matchId: match.id } }"
          class="card card-hover p-4 flex items-center gap-3"
        >
          <Avatar :src="otherPerson(match).profile.avatar_url" :name="otherPerson(match).name" size="lg" />
          <div class="min-w-0 flex-1">
            <p class="font-semibold text-ink">{{ otherPerson(match).name }}</p>
            <p class="text-sm text-ink-muted truncate">{{ match.activity.title }}</p>
          </div>
          <span class="w-8 h-8 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
            <FontAwesomeIcon :icon="categoryIcon(match.activity.category.slug)" class="text-xs" />
          </span>
        </RouterLink>
      </div>
    </div>
  </AppLayout>
</template>
