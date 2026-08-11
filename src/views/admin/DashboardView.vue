<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { adminApi } from '@/api/admin'
import { icons } from '@/lib/icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import type { DashboardStats } from '@/types'

const stats = ref<DashboardStats | null>(null)
const loading = ref(true)
const hasError = ref(false)

const cards = (s: DashboardStats): { label: string; value: string | number; icon: IconDefinition; alert?: boolean }[] => [
  { label: 'Jami foydalanuvchilar', value: s.total_users, icon: icons.people },
  { label: 'Tasdiqlangan', value: s.verified_users, icon: icons.verified },
  { label: 'Bugungi faoliyatlar', value: s.activities_today, icon: icons.today },
  { label: 'Yakunlangan faoliyatlar', value: s.completed_activities, icon: icons.completedFlag },
  { label: 'Tranzaksiyalar', value: s.total_transactions, icon: icons.payment },
  { label: 'Platforma daromadi', value: `${s.platform_revenue.toLocaleString()} UZS`, icon: icons.amount },
  { label: "Ko'rib chiqilmagan shikoyatlar", value: s.pending_reports, icon: icons.report, alert: s.pending_reports > 0 },
  { label: 'Kutilayotgan tasdiqlar', value: s.pending_verifications, icon: icons.identity, alert: s.pending_verifications > 0 },
]

async function load() {
  loading.value = true
  hasError.value = false
  try {
    const { data } = await adminApi.dashboard()
    stats.value = data.data
  } catch {
    hasError.value = true
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <AdminLayout>
    <h1 class="text-2xl font-bold text-ink mb-6">Dashboard</h1>

    <div v-if="loading" class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div v-for="i in 8" :key="i" class="card p-5 space-y-3">
        <Skeleton variant="circle" width="1.5rem" height="1.5rem" />
        <Skeleton variant="text" width="50%" />
        <Skeleton variant="text" width="70%" />
      </div>
    </div>

    <ErrorState v-else-if="hasError" @retry="load" />

    <div v-else-if="stats" class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div
        v-for="card in cards(stats)"
        :key="card.label"
        class="card p-5"
        :class="card.alert ? 'ring-2 ring-danger/30' : ''"
      >
        <div class="flex items-center justify-between mb-2">
          <span class="w-9 h-9 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
            <FontAwesomeIcon :icon="card.icon" />
          </span>
        </div>
        <p class="text-2xl font-bold text-ink">{{ card.value }}</p>
        <p class="text-sm text-ink-muted mt-1">{{ card.label }}</p>
      </div>
    </div>
  </AdminLayout>
</template>
