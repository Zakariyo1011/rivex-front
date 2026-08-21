<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AppLayout from '@/layouts/AppLayout.vue'
import ActivitiesTabs from '@/components/activity/ActivitiesTabs.vue'
import ActivityRow from '@/components/activity/ActivityRow.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { activitiesApi } from '@/api/activities'
import { useAuthStore } from '@/stores/auth'
import { icons } from '@/lib/icons'
import type { Activity } from '@/types'

/**
 * Everything this person has a stake in — organised or joined.
 *
 * This list could not exist before: `/me/activities` returned
 * `$user->activities()`, an ownership relation, so somebody who had joined four
 * meet-ups and organised none saw an empty screen. The endpoint now takes a
 * filter and this asks for `all`.
 *
 * Organiser and participant rows are separated rather than interleaved. They
 * are different jobs — one has applications to answer, the other has a place to
 * turn up to — and a single date-ordered list buries the three activities
 * waiting on a decision among the twelve that are not.
 */
const auth = useAuthStore()

const activities = ref<Activity[]>([])
const loaded = ref(false)
const loading = ref(false)
const hasError = ref(false)

const myId = computed(() => auth.user?.id)

const organised = computed(() => activities.value.filter((a) => a.owner?.id === myId.value))
const joined = computed(() => activities.value.filter((a) => a.owner?.id !== myId.value))

async function load() {
  loading.value = true
  hasError.value = false

  try {
    const { data } = await activitiesApi.mine('all')
    activities.value = data.data
    loaded.value = true
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
    <template #header>
      <h1 class="text-lg font-bold text-ink truncate">Faoliyatlar</h1>
    </template>

    <div class="px-4 md:px-8 pt-4 md:pt-8 max-w-2xl pb-8">
      <h1 class="hidden tablet:block text-xl font-bold text-ink mb-5">Faoliyatlar</h1>

      <ActivitiesTabs class="mb-5" />

      <div v-if="loading && !loaded" class="space-y-3">
        <div v-for="i in 3" :key="i" class="card p-4 space-y-2">
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="text" width="40%" />
        </div>
      </div>

      <ErrorState v-else-if="hasError && !loaded" @retry="load" />

      <EmptyState
        v-else-if="activities.length === 0"
        :icon="icons.createActivity"
        title="Hali faoliyatingiz yo'q"
        description="Faoliyat yarating yoki boshqalarnikiga qo'shiling."
      >
        <AppButton :icon="icons.add" @click="$router.push({ name: 'activity-create' })">
          Faoliyat yaratish
        </AppButton>
      </EmptyState>

      <template v-else>
        <section v-if="organised.length" class="mb-6">
          <h2 class="text-sm font-semibold text-ink-secondary mb-2.5">
            Men tashkil qilganlarim
          </h2>
          <div class="space-y-3">
            <ActivityRow
              v-for="activity in organised"
              :key="activity.id"
              :activity="activity"
              role="owner"
            />
          </div>
        </section>

        <section v-if="joined.length">
          <h2 class="text-sm font-semibold text-ink-secondary mb-2.5">Men qo'shilganlarim</h2>
          <div class="space-y-3">
            <ActivityRow
              v-for="activity in joined"
              :key="activity.id"
              :activity="activity"
              role="participant"
            />
          </div>
        </section>
      </template>
    </div>
  </AppLayout>
</template>
