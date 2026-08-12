<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AppLayout from '@/layouts/AppLayout.vue'
import AppTabs from '@/components/ui/AppTabs.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { applicationsApi } from '@/api/applications'
import { activitiesApi } from '@/api/activities'
import { categoryIcon, icons } from '@/lib/icons'
import type { Application, Activity, ActivityStatus } from '@/types'
import { formatActivityStart } from '@/lib/datetime'
import { applicationStatus } from '@/lib/statusLabels'

const tab = ref<'applications' | 'activities'>('applications')

const applications = ref<Application[]>([])
const applicationsLoaded = ref(false)
const applicationsError = ref(false)
const myActivities = ref<Activity[]>([])
const activitiesLoaded = ref(false)
const activitiesError = ref(false)

const tabs = [
  { value: 'applications', label: 'Mening arizalarim' },
  { value: 'activities', label: 'Mening faoliyatlarim' },
]

const activityStatusLabels: Record<ActivityStatus, string> = {
  draft: 'Qoralama',
  published: "E'lon qilingan",
  full: "To'lgan",
  in_progress: 'Davom etmoqda',
  completed: 'Yakunlangan',
  cancelled: 'Bekor qilingan',
  expired: "Muddati o'tgan",
}

const activityStatusVariants: Record<ActivityStatus, 'primary' | 'success' | 'danger' | 'neutral'> =
  {
    draft: 'neutral',
    published: 'primary',
    full: 'success',
    in_progress: 'success',
    completed: 'neutral',
    cancelled: 'danger',
    expired: 'neutral',
  }

async function cancel(application: Application) {
  await applicationsApi.cancel(application.id)
  application.status = 'cancelled'
}

async function loadApplications() {
  applicationsError.value = false
  try {
    const { data } = await applicationsApi.mine()
    applications.value = data.data
    applicationsLoaded.value = true
  } catch {
    applicationsError.value = true
  }
}

async function loadActivities() {
  activitiesError.value = false
  try {
    const { data } = await activitiesApi.mine()
    myActivities.value = data.data
    activitiesLoaded.value = true
  } catch {
    activitiesError.value = true
  }
}

async function selectTab(next: string) {
  tab.value = next as 'applications' | 'activities'
  if (next === 'activities' && !activitiesLoaded.value) await loadActivities()
}

onMounted(loadApplications)
</script>

<template>
  <AppLayout>
    <div class="px-4 md:px-8 pt-6 md:pt-8 max-w-2xl">
      <AppTabs :tabs="tabs" :model-value="tab" class="mb-5" @update:model-value="selectTab" />

      <div v-if="tab === 'applications'">
        <div v-if="!applicationsLoaded && !applicationsError" class="space-y-3">
          <div v-for="i in 3" :key="i" class="card p-4 space-y-2">
            <Skeleton variant="text" width="60%" />
            <Skeleton variant="text" width="40%" />
          </div>
        </div>
        <ErrorState v-else-if="applicationsError" @retry="loadApplications" />
        <EmptyState
          v-else-if="applications.length === 0"
          :icon="icons.applications"
          title="Hozircha ariza yubormagansiz"
        />

        <div v-else class="space-y-3">
          <div
            v-for="application in applications"
            :key="application.id"
            class="card card-hover p-4"
          >
            <RouterLink
              :to="{ name: 'activity-detail', params: { id: application.activity.id } }"
              class="flex items-start gap-3"
            >
              <span
                class="w-9 h-9 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center shrink-0"
              >
                <FontAwesomeIcon
                  :icon="categoryIcon(application.activity.category.slug)"
                  class="text-sm"
                />
              </span>
              <div class="min-w-0 flex-1">
                <p class="font-semibold text-ink">{{ application.activity.title }}</p>
                <p class="text-sm text-ink-muted">
                  {{ formatActivityStart(application.activity.start_at) }}
                </p>
                <p v-if="application.message" class="text-sm text-ink-muted mt-1 line-clamp-2">
                  "{{ application.message }}"
                </p>
              </div>
              <StatusBadge
                :status="application.status"
                :labels="applicationStatus.labels"
                :variants="applicationStatus.variants"
                class="shrink-0"
              />
            </RouterLink>

            <button
              v-if="application.status === 'pending'"
              class="text-sm text-danger font-medium mt-3"
              @click="cancel(application)"
            >
              Arizani bekor qilish
            </button>
          </div>
        </div>
      </div>

      <div v-else>
        <div v-if="!activitiesLoaded && !activitiesError" class="space-y-3">
          <div v-for="i in 3" :key="i" class="card p-4 space-y-2">
            <Skeleton variant="text" width="60%" />
            <Skeleton variant="text" width="40%" />
          </div>
        </div>
        <ErrorState v-else-if="activitiesError" @retry="loadActivities" />
        <EmptyState
          v-else-if="myActivities.length === 0"
          :icon="icons.createActivity"
          title="Hozircha faoliyat yaratmagansiz"
        />

        <div v-else class="space-y-3">
          <RouterLink
            v-for="activity in myActivities"
            :key="activity.id"
            :to="{ name: 'activity-detail', params: { id: activity.id } }"
            class="card card-hover p-4 flex items-start gap-3"
          >
            <span
              class="w-9 h-9 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center shrink-0"
            >
              <FontAwesomeIcon :icon="categoryIcon(activity.category.slug)" class="text-sm" />
            </span>
            <div class="min-w-0 flex-1">
              <p class="font-semibold text-ink">{{ activity.title }}</p>
              <p class="text-sm text-ink-muted">{{ formatActivityStart(activity.start_at) }}</p>
            </div>
            <StatusBadge
              :status="activity.status"
              :labels="activityStatusLabels"
              :variants="activityStatusVariants"
              class="shrink-0"
            />
          </RouterLink>
        </div>
      </div>
    </div>
  </AppLayout>
</template>
