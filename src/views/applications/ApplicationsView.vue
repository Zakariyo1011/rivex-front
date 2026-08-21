<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AppLayout from '@/layouts/AppLayout.vue'
import AppTabs from '@/components/ui/AppTabs.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import ActivitiesTabs from '@/components/activity/ActivitiesTabs.vue'
import ActivityRow from '@/components/activity/ActivityRow.vue'
import { applicationsApi } from '@/api/applications'
import { activitiesApi } from '@/api/activities'
import { useAuthStore } from '@/stores/auth'
import { categoryIcon, icons } from '@/lib/icons'
import type { Application, Activity } from '@/types'
import { formatActivityStart } from '@/lib/datetime'
import { applicationStatus } from '@/lib/statusLabels'

/**
 * Applications, both directions.
 *
 * ## What changed and why
 *
 * The two tabs used to be "my applications" and "my activities", which put the
 * activity list behind a screen called Arizalar and left **received**
 * applications with no home at all — an organiser could only reach them by
 * opening each activity in turn. My Activities has its own screen now, and this
 * one answers the question its title asks: who is waiting on me, and what am I
 * waiting on.
 *
 * The received tab is built from `/me/activities`, which already carries
 * `pending_applications_count` per activity, rather than a new endpoint. The
 * triage is per activity because that is where accepting happens — see
 * `incoming-applications`, which this links into and which already exists.
 *
 * The local `activityStatusLabels` / `activityStatusVariants` maps that used to
 * live here are gone: `lib/statusLabels` has held the canonical copy since the
 * admin list and the detail page disagreed about it, and `ActivityRow` reads it.
 */
const auth = useAuthStore()

const tab = ref<'sent' | 'received'>('sent')

const applications = ref<Application[]>([])
const applicationsLoaded = ref(false)
const applicationsError = ref(false)

const ownedActivities = ref<Activity[]>([])
const ownedLoaded = ref(false)
const ownedError = ref(false)

const pendingTotal = computed(() => auth.counters?.pending_applications ?? 0)

const tabs = computed(() => [
  { value: 'sent', label: 'Yuborilgan' },
  {
    value: 'received',
    label: pendingTotal.value > 0 ? `Kelgan (${pendingTotal.value})` : 'Kelgan',
  },
])

/** Only the activities that actually need a decision. */
const awaiting = computed(() =>
  ownedActivities.value.filter((a) => (a.pending_applications_count ?? 0) > 0),
)

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

async function loadOwned() {
  ownedError.value = false
  try {
    const { data } = await activitiesApi.mine('owned')
    ownedActivities.value = data.data
    ownedLoaded.value = true
  } catch {
    ownedError.value = true
  }
}

async function selectTab(next: string) {
  tab.value = next as 'sent' | 'received'
  if (next === 'received' && !ownedLoaded.value) await loadOwned()
}

onMounted(loadApplications)
</script>

<template>
  <AppLayout>
    <template #header>
      <h1 class="text-lg font-bold text-ink truncate">Faoliyatlar</h1>
    </template>

    <div class="px-4 md:px-8 pt-4 md:pt-8 max-w-2xl pb-8">
      <h1 class="hidden tablet:block text-xl font-bold text-ink mb-5">Faoliyatlar</h1>

      <ActivitiesTabs class="mb-4" />

      <AppTabs :tabs="tabs" :model-value="tab" class="mb-5" @update:model-value="selectTab" />

      <!-- Applications this user sent -->
      <div v-if="tab === 'sent'">
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
          description="Faoliyatlarni ko'rib chiqing va qiziqarlisiga qo'shiling."
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
                <p class="font-semibold text-ink truncate">{{ application.activity.title }}</p>
                <p class="text-sm text-ink-muted truncate">
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

      <!-- Applications waiting on this user's decision -->
      <div v-else>
        <div v-if="!ownedLoaded && !ownedError" class="space-y-3">
          <div v-for="i in 3" :key="i" class="card p-4 space-y-2">
            <Skeleton variant="text" width="60%" />
            <Skeleton variant="text" width="40%" />
          </div>
        </div>
        <ErrorState v-else-if="ownedError" @retry="loadOwned" />
        <EmptyState
          v-else-if="awaiting.length === 0"
          :icon="icons.applications"
          title="Yangi ariza yo'q"
          description="Faoliyatlaringizga ariza kelganda shu yerda ko'rinadi."
        />

        <div v-else class="space-y-3">
          <ActivityRow
            v-for="activity in awaiting"
            :key="activity.id"
            :activity="activity"
            role="owner"
          />
        </div>
      </div>
    </div>
  </AppLayout>
</template>
