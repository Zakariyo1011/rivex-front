<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import { adminApi } from '@/api/admin'
import type { Report } from '@/types'

const reports = ref<Report[]>([])
const loading = ref(true)
const statusFilter = ref('pending')
const actingId = ref<number | null>(null)

const reasonLabels: Record<string, string> = {
  fake_account: 'Soxta akkaunt',
  harassment: 'Bezovtalik',
  scam: 'Firibgarlik',
  unsafe_behavior: 'Xavfli xatti-harakat',
  inappropriate_content: 'Nomaqbul kontent',
  no_show: 'Kelmadi',
  payment_problem: "To'lov muammosi",
  other: 'Boshqa',
}

const statusClasses: Record<string, string> = {
  pending: 'bg-primary-50 text-primary-700',
  reviewed: 'bg-amber-50 text-amber-600',
  resolved: 'bg-success-bg text-success',
  dismissed: 'bg-surface-muted text-ink-muted',
}

async function load() {
  loading.value = true
  const { data } = await adminApi.reports({ status: statusFilter.value || undefined })
  reports.value = data.data
  loading.value = false
}

async function resolve(report: Report, status: 'resolved' | 'dismissed') {
  actingId.value = report.id
  try {
    const { data } = await adminApi.resolveReport(report.id, status)
    const index = reports.value.findIndex((r) => r.id === report.id)
    if (index !== -1) reports.value[index] = data.data
  } finally {
    actingId.value = null
  }
}

onMounted(load)
</script>

<template>
  <AdminLayout>
    <h1 class="text-2xl font-bold text-ink mb-6">Shikoyatlar</h1>

    <select
      v-model="statusFilter"
      class="h-10 px-3 rounded-xl border border-border bg-white text-sm outline-none mb-5"
      @change="load"
    >
      <option value="">Barchasi</option>
      <option value="pending">Kutilmoqda</option>
      <option value="reviewed">Ko'rib chiqilmoqda</option>
      <option value="resolved">Hal qilindi</option>
      <option value="dismissed">Rad etildi</option>
    </select>

    <div v-if="loading" class="text-ink-faint text-sm">Yuklanmoqda...</div>
    <div v-else-if="reports.length === 0" class="text-ink-faint text-sm">Shikoyatlar yo'q.</div>

    <div v-else class="space-y-3">
      <div v-for="report in reports" :key="report.id" class="card p-5">
        <div class="flex items-center justify-between mb-2">
          <RouterLink :to="{ name: 'user-profile', params: { id: report.reported_user.id } }" class="font-semibold text-ink hover:text-primary-600">
            {{ report.reported_user.name }}
          </RouterLink>
          <span class="text-xs font-semibold px-2.5 py-1 rounded-full" :class="statusClasses[report.status]">
            {{ report.status }}
          </span>
        </div>
        <p class="text-sm text-primary-600 font-medium mb-1">{{ reasonLabels[report.reason] ?? report.reason }}</p>
        <p v-if="report.description" class="text-sm text-ink-muted mb-3">{{ report.description }}</p>
        <p class="text-xs text-ink-faint mb-3">{{ new Date(report.created_at).toLocaleString('uz-UZ') }}</p>

        <div v-if="report.status === 'pending'" class="flex gap-3">
          <button
            class="text-sm font-medium text-success disabled:opacity-50"
            :disabled="actingId === report.id"
            @click="resolve(report, 'resolved')"
          >
            Hal qilindi deb belgilash
          </button>
          <button
            class="text-sm font-medium text-ink-muted disabled:opacity-50"
            :disabled="actingId === report.id"
            @click="resolve(report, 'dismissed')"
          >
            Rad etish
          </button>
        </div>
      </div>
    </div>
  </AdminLayout>
</template>
