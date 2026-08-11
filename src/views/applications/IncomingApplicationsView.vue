<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import AppButton from '@/components/ui/AppButton.vue'
import Avatar from '@/components/ui/Avatar.vue'
import VerificationBadge from '@/components/ui/VerificationBadge.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { applicationsApi } from '@/api/applications'
import { extractErrorMessage } from '@/composables/useApiError'
import { icons } from '@/lib/icons'
import type { Application, ApplicationStatus } from '@/types'

const route = useRoute()
const router = useRouter()

const applications = ref<Application[]>([])
const loading = ref(true)
const hasError = ref(false)
const actingId = ref<number | null>(null)
const error = ref('')

const statusLabels: Record<ApplicationStatus, string> = {
  pending: 'Kutilmoqda',
  accepted: 'Qabul qilindi',
  rejected: 'Rad etildi',
  cancelled: 'Bekor qilindi',
  expired: "Muddati o'tgan",
}

const statusVariants: Record<ApplicationStatus, 'primary' | 'success' | 'danger' | 'neutral'> = {
  pending: 'primary',
  accepted: 'success',
  rejected: 'danger',
  cancelled: 'neutral',
  expired: 'neutral',
}

async function load() {
  loading.value = true
  hasError.value = false
  try {
    const { data } = await applicationsApi.incoming(Number(route.params.id))
    applications.value = data.data
  } catch {
    hasError.value = true
  } finally {
    loading.value = false
  }
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

      <div v-if="loading" class="space-y-3">
        <div v-for="i in 3" :key="i" class="card p-4 space-y-3">
          <div class="flex items-center gap-3">
            <Skeleton variant="circle" width="2.75rem" height="2.75rem" />
            <div class="flex-1 space-y-1.5">
              <Skeleton variant="text" width="45%" />
              <Skeleton variant="text" width="25%" />
            </div>
          </div>
          <Skeleton variant="block" height="2.5rem" />
        </div>
      </div>

      <ErrorState v-else-if="hasError" @retry="load" />

      <EmptyState
        v-else-if="applications.length === 0"
        :icon="icons.applications"
        title="Hozircha ariza kelmagan"
      />

      <div v-else class="space-y-3">
        <div v-for="application in applications" :key="application.id" class="card card-hover p-4">
          <RouterLink
            :to="{ name: 'user-profile', params: { id: application.applicant.id } }"
            class="flex items-center gap-3 mb-3"
          >
            <Avatar :src="application.applicant.profile.avatar_url" :name="application.applicant.name" size="lg" />
            <div class="min-w-0 flex-1">
              <p class="font-semibold text-ink flex items-center gap-1.5">
                {{ application.applicant.name }}
                <VerificationBadge v-if="application.applicant.identity_verified" compact />
              </p>
              <p v-if="application.applicant.rating_average" class="text-sm text-ink-muted flex items-center gap-1">
                <FontAwesomeIcon :icon="icons.starSolid" class="text-star" />
                {{ application.applicant.rating_average }}
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
          <StatusBadge v-else :status="application.status" :labels="statusLabels" :variants="statusVariants" />
        </div>
      </div>
    </div>
  </AppLayout>
</template>
