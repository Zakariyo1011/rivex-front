<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { adminApi } from '@/api/admin'
import type { Withdrawal } from '@/types'
import {formatDate, formatMoney} from '@/lib/datetime'

const withdrawals = ref<Withdrawal[]>([])
const loading = ref(true)
const hasError = ref(false)
const statusFilter = ref('pending')
const actingId = ref<number | null>(null)

const statusLabels: Record<string, string> = {
  pending: 'Kutilmoqda',
  approved: 'Tasdiqlandi',
  paid: "To'landi",
  rejected: 'Rad etildi',
}

const statusVariants: Record<string, 'primary' | 'warning' | 'success' | 'danger'> = {
  pending: 'primary',
  approved: 'warning',
  paid: 'success',
  rejected: 'danger',
}

async function load() {
  loading.value = true
  hasError.value = false
  try {
    const { data } = await adminApi.withdrawals({ status: statusFilter.value || undefined })
    withdrawals.value = data.data
  } catch {
    hasError.value = true
  } finally {
    loading.value = false
  }
}

async function approve(withdrawal: Withdrawal) {
  actingId.value = withdrawal.id
  try {
    const { data } = await adminApi.approveWithdrawal(withdrawal.id)
    const index = withdrawals.value.findIndex((w) => w.id === withdrawal.id)
    if (index !== -1) withdrawals.value[index] = data.data
  } finally {
    actingId.value = null
  }
}

async function reject(withdrawal: Withdrawal) {
  actingId.value = withdrawal.id
  try {
    const { data } = await adminApi.rejectWithdrawal(withdrawal.id)
    const index = withdrawals.value.findIndex((w) => w.id === withdrawal.id)
    if (index !== -1) withdrawals.value[index] = data.data
  } finally {
    actingId.value = null
  }
}

onMounted(load)
</script>

<template>
  <AdminLayout>
    <h1 class="text-2xl font-bold text-ink mb-6">Pul yechish so'rovlari</h1>

    <select
      v-model="statusFilter"
      class="h-10 px-3 rounded-xl border border-border bg-surface text-sm outline-none mb-5"
      @change="load"
    >
      <option value="">Barchasi</option>
      <option value="pending">Kutilmoqda</option>
      <option value="paid">To'landi</option>
      <option value="rejected">Rad etildi</option>
    </select>

    <div class="card overflow-hidden">
      <div class="overflow-x-auto">
      <table class="w-full text-sm min-w-[640px]">
        <thead>
          <tr class="border-b border-border text-left text-ink-faint">
            <th class="px-5 py-3 font-medium">Foydalanuvchi</th>
            <th class="px-5 py-3 font-medium">Summa</th>
            <th class="px-5 py-3 font-medium">Sana</th>
            <th class="px-5 py-3 font-medium">Holat</th>
            <th class="px-5 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="5" class="px-5 py-3" v-for="i in 5" :key="i"><Skeleton variant="text" width="80%" /></td>
          </tr>
          <tr v-else-if="hasError">
            <td colspan="5" class="px-5 py-8"><ErrorState @retry="load" /></td>
          </tr>
          <tr v-else-if="withdrawals.length === 0">
            <td colspan="5" class="px-5 py-8 text-center text-ink-faint">So'rovlar yo'q.</td>
          </tr>
          <tr v-for="withdrawal in withdrawals" :key="withdrawal.id" class="border-b border-border last:border-0">
            <td class="px-5 py-3">
              <RouterLink :to="{ name: 'user-profile', params: { id: withdrawal.user.id } }" class="font-medium text-ink hover:text-primary-600">
                {{ withdrawal.user.name }}
              </RouterLink>
            </td>
            <td class="px-5 py-3 font-semibold text-ink">{{ formatMoney(withdrawal.amount) }}</td>
            <td class="px-5 py-3 text-ink-muted">{{ formatDate(withdrawal.created_at) }}</td>
            <td class="px-5 py-3">
              <StatusBadge :status="withdrawal.status" :labels="statusLabels" :variants="statusVariants" />
            </td>
            <td class="px-5 py-3 text-right space-x-3" v-if="withdrawal.status === 'pending'">
              <button
                class="text-xs font-medium text-success disabled:opacity-50"
                :disabled="actingId === withdrawal.id"
                @click="approve(withdrawal)"
              >
                Tasdiqlash
              </button>
              <button
                class="text-xs font-medium text-danger disabled:opacity-50"
                :disabled="actingId === withdrawal.id"
                @click="reject(withdrawal)"
              >
                Rad etish
              </button>
            </td>
            <td v-else></td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>
  </AdminLayout>
</template>
