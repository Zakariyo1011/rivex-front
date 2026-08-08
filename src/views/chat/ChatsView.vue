<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AppLayout from '@/layouts/AppLayout.vue'
import { matchesApi } from '@/api/matches'
import { useAuthStore } from '@/stores/auth'
import type { ActivityMatch } from '@/types'

const auth = useAuthStore()
const matches = ref<ActivityMatch[]>([])
const loading = ref(true)

function otherPerson(match: ActivityMatch) {
  if (match.activity.owner.id !== auth.user?.id) return match.activity.owner
  return match.participants.find((p) => p.id !== auth.user?.id) ?? match.activity.owner
}

onMounted(async () => {
  const { data } = await matchesApi.list()
  matches.value = data.data
  loading.value = false
})
</script>

<template>
  <AppLayout>
    <div class="px-4 md:px-8 pt-6 md:pt-8 max-w-2xl">
      <h1 class="text-xl font-bold text-ink mb-5">Suhbatlar</h1>

      <div v-if="loading" class="text-ink-faint text-sm py-12 text-center">Yuklanmoqda...</div>
      <div v-else-if="matches.length === 0" class="text-ink-faint text-sm py-12 text-center">
        Hozircha suhbatlaringiz yo'q. Ariza qabul qilinganda shu yerda paydo bo'ladi.
      </div>

      <div v-else class="space-y-2">
        <RouterLink
          v-for="match in matches"
          :key="match.id"
          :to="{ name: 'chat-detail', params: { matchId: match.id } }"
          class="card p-4 flex items-center gap-3"
        >
          <div class="w-12 h-12 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold overflow-hidden shrink-0">
            <img v-if="otherPerson(match).profile.avatar_url" :src="otherPerson(match).profile.avatar_url!" class="w-full h-full object-cover" />
            <span v-else>{{ otherPerson(match).name[0] }}</span>
          </div>
          <div class="min-w-0 flex-1">
            <p class="font-semibold text-ink">{{ otherPerson(match).name }}</p>
            <p class="text-sm text-ink-muted truncate">{{ match.activity.title }}</p>
          </div>
          <span class="text-lg">{{ match.activity.category.icon }}</span>
        </RouterLink>
      </div>
    </div>
  </AppLayout>
</template>
