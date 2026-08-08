<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { applicationsApi } from '@/api/applications'
import { extractErrorMessage } from '@/composables/useApiError'
import type { Application } from '@/types'

const route = useRoute()
const router = useRouter()

const applications = ref<Application[]>([])
const loading = ref(true)
const actingId = ref<number | null>(null)
const error = ref('')

async function load() {
  loading.value = true
  const { data } = await applicationsApi.incoming(Number(route.params.id))
  applications.value = data.data
  loading.value = false
}

async function accept(application: Application) {
  error.value = ''
  actingId.value = application.id
  try {
    await applicationsApi.accept(application.id)
    router.push({ name: 'chats' })
  } catch (e) {
    error.value = extractErrorMessage(e)
    await load()
  } finally {
    actingId.value = null
  }
}

async function reject(application: Application) {
  actingId.value = application.id
  try {
    await applicationsApi.reject(application.id)
    application.status = 'rejected'
  } finally {
    actingId.value = null
  }
}

onMounted(load)
</script>

<template>
  <AppLayout>
    <div class="px-4 md:px-8 pt-6 md:pt-8 max-w-2xl">
      <h1 class="text-xl font-bold text-ink mb-5">Kelgan arizalar</h1>

      <p v-if="error" class="text-sm text-danger mb-4">{{ error }}</p>

      <div v-if="loading" class="text-ink-faint text-sm py-12 text-center">Yuklanmoqda...</div>
      <div v-else-if="applications.length === 0" class="text-ink-faint text-sm py-12 text-center">
        Hozircha ariza kelmagan.
      </div>

      <div v-else class="space-y-3">
        <div v-for="application in applications" :key="application.id" class="card p-4">
          <RouterLink
            :to="{ name: 'user-profile', params: { id: application.applicant.id } }"
            class="flex items-center gap-3 mb-3"
          >
            <div class="w-11 h-11 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold overflow-hidden">
              <img v-if="application.applicant.profile.avatar_url" :src="application.applicant.profile.avatar_url" class="w-full h-full object-cover" />
              <span v-else>{{ application.applicant.name[0] }}</span>
            </div>
            <div class="min-w-0 flex-1">
              <p class="font-semibold text-ink flex items-center gap-1.5">
                {{ application.applicant.name }}
                <span v-if="application.applicant.identity_verified" class="text-primary-500 text-xs">✓</span>
              </p>
              <p v-if="application.applicant.rating_average" class="text-sm text-star">
                ⭐ {{ application.applicant.rating_average }}
              </p>
            </div>
          </RouterLink>

          <p v-if="application.message" class="text-sm text-ink-muted bg-surface-muted rounded-lg p-3 mb-3">
            "{{ application.message }}"
          </p>

          <div v-if="application.status === 'pending'" class="flex gap-2">
            <AppButton :loading="actingId === application.id" @click="accept(application)">Qabul qilish</AppButton>
            <AppButton variant="outline" :disabled="actingId === application.id" @click="reject(application)">
              Rad etish
            </AppButton>
          </div>
          <span
            v-else
            class="text-xs font-semibold px-2.5 py-1 rounded-full"
            :class="
              application.status === 'accepted'
                ? 'bg-success-bg text-success'
                : 'bg-surface-muted text-ink-muted'
            "
          >
            {{ application.status === 'accepted' ? 'Qabul qilindi' : 'Rad etildi' }}
          </span>
        </div>
      </div>
    </div>
  </AppLayout>
</template>
