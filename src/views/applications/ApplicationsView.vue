<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AppLayout from '@/layouts/AppLayout.vue'
import { applicationsApi } from '@/api/applications'
import { activitiesApi } from '@/api/activities'
import type { Application, ApplicationStatus, Activity, ActivityStatus } from '@/types'

const tab = ref<'applications' | 'activities'>('applications')

const applications = ref<Application[]>([])
const applicationsLoaded = ref(false)
const myActivities = ref<Activity[]>([])
const activitiesLoaded = ref(false)

const statusLabels: Record<ApplicationStatus, string> = {
  pending: 'Kutilmoqda',
  accepted: 'Qabul qilindi',
  rejected: 'Rad etildi',
  cancelled: 'Bekor qilindi',
  expired: "Muddati o'tgan",
}

const statusClasses: Record<ApplicationStatus, string> = {
  pending: 'bg-primary-50 text-primary-700',
  accepted: 'bg-success-bg text-success',
  rejected: 'bg-danger-bg text-danger',
  cancelled: 'bg-surface-muted text-ink-muted',
  expired: 'bg-surface-muted text-ink-muted',
}

const activityStatusLabels: Record<ActivityStatus, string> = {
  draft: 'Qoralama',
  published: "E'lon qilingan",
  full: "To'lgan",
  in_progress: 'Davom etmoqda',
  completed: 'Yakunlangan',
  cancelled: 'Bekor qilingan',
}

const activityStatusClasses: Record<ActivityStatus, string> = {
  draft: 'bg-surface-muted text-ink-muted',
  published: 'bg-primary-50 text-primary-700',
  full: 'bg-success-bg text-success',
  in_progress: 'bg-success-bg text-success',
  completed: 'bg-surface-muted text-ink-muted',
  cancelled: 'bg-danger-bg text-danger',
}

async function cancel(application: Application) {
  await applicationsApi.cancel(application.id)
  application.status = 'cancelled'
}

async function selectTab(next: 'applications' | 'activities') {
  tab.value = next
  if (next === 'activities' && !activitiesLoaded.value) {
    const { data } = await activitiesApi.mine()
    myActivities.value = data.data
    activitiesLoaded.value = true
  }
}

onMounted(async () => {
  const { data } = await applicationsApi.mine()
  applications.value = data.data
  applicationsLoaded.value = true
})
</script>

<template>
  <AppLayout>
    <div class="px-4 md:px-8 pt-6 md:pt-8 max-w-2xl">
      <div class="flex gap-1 p-1 rounded-xl bg-surface-muted mb-5">
        <button
          class="flex-1 h-10 rounded-lg text-sm font-semibold transition"
          :class="tab === 'applications' ? 'bg-white text-ink shadow-sm' : 'text-ink-muted'"
          @click="selectTab('applications')"
        >
          Mening arizalarim
        </button>
        <button
          class="flex-1 h-10 rounded-lg text-sm font-semibold transition"
          :class="tab === 'activities' ? 'bg-white text-ink shadow-sm' : 'text-ink-muted'"
          @click="selectTab('activities')"
        >
          Mening faoliyatlarim
        </button>
      </div>

      <div v-if="tab === 'applications'">
        <div v-if="!applicationsLoaded" class="text-ink-faint text-sm py-12 text-center">Yuklanmoqda...</div>
        <div v-else-if="applications.length === 0" class="text-ink-faint text-sm py-12 text-center">
          Hozircha ariza yubormagansiz.
        </div>

        <div v-else class="space-y-3">
          <div v-for="application in applications" :key="application.id" class="card p-4">
            <RouterLink
              :to="{ name: 'activity-detail', params: { id: application.activity.id } }"
              class="flex items-start gap-3"
            >
              <span class="text-2xl">{{ application.activity.category.icon }}</span>
              <div class="min-w-0 flex-1">
                <p class="font-semibold text-ink">{{ application.activity.title }}</p>
                <p class="text-sm text-ink-muted">
                  {{ new Date(application.activity.start_at).toLocaleString('uz-UZ') }}
                </p>
                <p v-if="application.message" class="text-sm text-ink-muted mt-1 line-clamp-2">
                  "{{ application.message }}"
                </p>
              </div>
              <span
                class="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full"
                :class="statusClasses[application.status]"
              >
                {{ statusLabels[application.status] }}
              </span>
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
        <div v-if="!activitiesLoaded" class="text-ink-faint text-sm py-12 text-center">Yuklanmoqda...</div>
        <div v-else-if="myActivities.length === 0" class="text-ink-faint text-sm py-12 text-center">
          Hozircha faoliyat yaratmagansiz.
        </div>

        <div v-else class="space-y-3">
          <RouterLink
            v-for="activity in myActivities"
            :key="activity.id"
            :to="{ name: 'activity-detail', params: { id: activity.id } }"
            class="card p-4 flex items-start gap-3"
          >
            <span class="text-2xl">{{ activity.category.icon }}</span>
            <div class="min-w-0 flex-1">
              <p class="font-semibold text-ink">{{ activity.title }}</p>
              <p class="text-sm text-ink-muted">{{ new Date(activity.start_at).toLocaleString('uz-UZ') }}</p>
            </div>
            <span
              class="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full"
              :class="activityStatusClasses[activity.status]"
            >
              {{ activityStatusLabels[activity.status] }}
            </span>
          </RouterLink>
        </div>
      </div>
    </div>
  </AppLayout>
</template>
