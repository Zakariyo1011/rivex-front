<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import AppButton from '@/components/ui/AppButton.vue'
import Avatar from '@/components/ui/Avatar.vue'
import Rating from '@/components/ui/Rating.vue'
import VerificationBadge from '@/components/ui/VerificationBadge.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { activitiesApi } from '@/api/activities'
import { applicationsApi } from '@/api/applications'
import { extractErrorMessage } from '@/composables/useApiError'
import { icons } from '@/lib/icons'
import type { Activity, Application } from '@/types'
import { activityStatus, applicationStatus } from '@/lib/statusLabels'
import { userProfileRoute } from '@/lib/userLink'

const route = useRoute()
const router = useRouter()

const applications = ref<Application[]>([])
const activity = ref<Activity | null>(null)
const loading = ref(true)
const hasError = ref(false)
const actingId = ref<number | null>(null)
const error = ref('')

/**
 * Whether this activity can still take somebody on.
 *
 * 🔴 This screen offered Accept and Reject on any pending row, whatever had
 * become of the activity. Completing an activity did not close its outstanding
 * applications, so a meet-up that had happened still showed an Accept button —
 * and pressing it used to add a participant, raise an invoice and write `full`
 * straight over `completed`. That is the "completed does not stay completed"
 * bug, seen from the screen that caused it.
 *
 * Both halves are fixed server-side (MatchService refuses, and completion now
 * expires the applications). This says so before the attempt, because a button
 * that only ever returns an error is not a button.
 */
const isOpen = computed(() => activity.value?.status === 'published')

async function load() {
  loading.value = true
  hasError.value = false
  try {
    const [applicationsRes, activityRes] = await Promise.all([
      applicationsApi.incoming(Number(route.params.id)),
      activitiesApi.show(route.params.id as string),
    ])

    applications.value = applicationsRes.data.data
    activity.value = activityRes.data.data
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
      <h1 class="text-xl font-bold text-ink mb-1">Kelgan arizalar</h1>
      <p v-if="activity" class="text-sm text-ink-muted mb-5 flex items-center gap-2 flex-wrap">
        <span class="truncate">{{ activity.title }}</span>
        <StatusBadge
          v-if="activity.status !== 'published'"
          :status="activity.status"
          :labels="activityStatus.labels"
          :variants="activityStatus.variants"
        />
      </p>
      <div v-else class="mb-5" />

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
            :to="userProfileRoute(application.applicant)!"
            class="flex items-center gap-3 mb-3"
          >
            <Avatar
              :src="application.applicant.profile.avatar_url"
              :name="application.applicant.name"
              size="lg"
            />
            <div class="min-w-0 flex-1">
              <p class="font-semibold text-ink flex items-center gap-1.5">
                {{ application.applicant.name }}
                <VerificationBadge v-if="application.applicant.identity_verified" compact />
              </p>
              <Rating
                v-if="application.applicant.rating_average"
                :value="application.applicant.rating_average"
              />
            </div>
          </RouterLink>

          <p
            v-if="application.message"
            class="text-sm text-ink-muted bg-surface-muted rounded-lg p-3 mb-3"
          >
            "{{ application.message }}"
          </p>

          <div v-if="application.status === 'pending' && isOpen" class="flex gap-2">
            <AppButton :loading="actingId === application.id" @click="accept(application)"
              >Qabul qilish</AppButton
            >
            <AppButton
              variant="outline"
              :disabled="actingId === application.id"
              @click="reject(application)"
            >
              Rad etish
            </AppButton>
          </div>
          <!-- Still pending on the row, but the activity has moved on. Naming
               the activity's state is the useful thing to say; the application
               status alone ("Kutilmoqda") would suggest a decision is owed. -->
          <p
            v-else-if="application.status === 'pending'"
            class="text-sm text-ink-muted flex items-center gap-2"
          >
            <FontAwesomeIcon :icon="icons.lock" class="text-xs" />
            {{ activityStatus.labels[activity!.status] }} — yangi ishtirokchi qabul qilinmaydi
          </p>

          <StatusBadge
            v-else
            :status="application.status"
            :labels="applicationStatus.labels"
            :variants="applicationStatus.variants"
          />
        </div>
      </div>
    </div>
  </AppLayout>
</template>
