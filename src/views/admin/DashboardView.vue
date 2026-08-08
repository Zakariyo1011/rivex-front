<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import { adminApi } from '@/api/admin'
import type { DashboardStats } from '@/types'

const stats = ref<DashboardStats | null>(null)
const loading = ref(true)

const cards = (s: DashboardStats) => [
  { label: 'Jami foydalanuvchilar', value: s.total_users, icon: '👥' },
  { label: 'Tasdiqlangan', value: s.verified_users, icon: '✓' },
  { label: 'Bugungi faoliyatlar', value: s.activities_today, icon: '🎯' },
  { label: 'Yakunlangan faoliyatlar', value: s.completed_activities, icon: '🏁' },
  { label: 'Tranzaksiyalar', value: s.total_transactions, icon: '💳' },
  { label: 'Platforma daromadi', value: `${s.platform_revenue.toLocaleString()} UZS`, icon: '💰' },
  { label: 'Ko\'rib chiqilmagan shikoyatlar', value: s.pending_reports, icon: '🚩', alert: s.pending_reports > 0 },
  { label: 'Kutilayotgan tasdiqlar', value: s.pending_verifications, icon: '🪪', alert: s.pending_verifications > 0 },
]

onMounted(async () => {
  const { data } = await adminApi.dashboard()
  stats.value = data.data
  loading.value = false
})
</script>

<template>
  <AdminLayout>
    <h1 class="text-2xl font-bold text-ink mb-6">Dashboard</h1>

    <div v-if="loading" class="text-ink-faint text-sm">Yuklanmoqda...</div>

    <div v-else-if="stats" class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div
        v-for="card in cards(stats)"
        :key="card.label"
        class="card p-5"
        :class="card.alert ? 'ring-2 ring-danger/30' : ''"
      >
        <div class="flex items-center justify-between mb-2">
          <span class="text-xl">{{ card.icon }}</span>
        </div>
        <p class="text-2xl font-bold text-ink">{{ card.value }}</p>
        <p class="text-sm text-ink-muted mt-1">{{ card.label }}</p>
      </div>
    </div>
  </AdminLayout>
</template>
