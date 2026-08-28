<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import AppTabs from '@/components/ui/AppTabs.vue'
import SparkChart from '@/components/admin/SparkChart.vue'
import { adminApi } from '@/api/admin'
import { icons } from '@/lib/icons'
import { formatAmount } from '@/lib/money'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import type { DashboardStats, FinancialOverview, FinancialSeries } from '@/types'

/**
 * The admin dashboard.
 *
 * Two bands: what the platform IS (people, activities, queues) and what it
 * EARNS. They are separated because they are read by different people for
 * different reasons, and mixing a revenue figure into a moderation queue makes
 * both harder to scan.
 *
 * Every number comes from the database on each load — nothing here is cached
 * or hardcoded. And when the money is simulated the whole financial band says
 * so, at the top, unmissably: an administrator reading "5 000 UZS revenue"
 * without knowing it is mock data is the most expensive misunderstanding this
 * product can produce.
 */
const stats = ref<DashboardStats | null>(null)
const finance = ref<FinancialOverview | null>(null)
const series = ref<FinancialSeries | null>(null)
const loading = ref(true)
const hasError = ref(false)
const range = ref('30')

const rangeTabs = [
  { value: '7', label: '7 kun' },
  { value: '30', label: '30 kun' },
  { value: '90', label: '90 kun' },
]

interface Card {
  label: string
  value: string | number
  sub?: string
  icon: IconDefinition
  alert?: boolean
}

const operationalCards = computed<Card[]>(() => {
  const s = stats.value

  if (!s) return []

  return [
    {
      label: 'Jami foydalanuvchilar',
      value: s.total_users,
      sub: `Bugun +${s.new_users_today} · Hafta +${s.new_users_this_week} · Oy +${s.new_users_this_month}`,
      icon: icons.people,
    },
    { label: 'Tasdiqlangan shaxs', value: s.verified_users, icon: icons.verified },
    { label: 'Bugungi faoliyatlar', value: s.activities_today, icon: icons.today },
    { label: 'Yakunlangan faoliyatlar', value: s.completed_activities, icon: icons.completedFlag },
    {
      label: "Ko'rib chiqilmagan shikoyatlar",
      value: s.pending_reports,
      icon: icons.report,
      alert: s.pending_reports > 0,
    },
    {
      label: 'Kutilayotgan tasdiqlar',
      value: s.pending_verifications,
      icon: icons.identity,
      alert: s.pending_verifications > 0,
    },
    {
      label: 'Kutilayotgan yechishlar',
      value: s.pending_withdrawals,
      icon: icons.payment,
      alert: s.pending_withdrawals > 0,
    },
    { label: "To'lanmagan hisob-fakturalar", value: s.unpaid_invoices, icon: icons.receipt },
  ]
})

const financialCards = computed<Card[]>(() => {
  const f = finance.value

  if (!f) return []

  const label = `${f.test_mode ? 'TEST ' : ''}${f.currency}`
  const money = (value: { major: number }) => `${formatAmount(value.major, f.currency)} ${label}`

  return [
    {
      label: "Qo'shilgan test summa",
      value: money(f.test_money.total_added),
      sub: `Bugun ${money(f.test_money.today)}`,
      icon: icons.topUp,
    },
    {
      label: 'Hamyonlardagi balans',
      value: money(f.test_money.wallet_balance),
      sub: `Yechishda ${money(f.test_money.wallet_pending)}`,
      icon: icons.wallet,
    },
    {
      label: 'Tranzaksiya hajmi',
      value: money(f.volume.total),
      sub: `Oy ${money(f.volume.this_month)}`,
      icon: icons.amount,
    },
    {
      label: `Rivex komissiyasi (${f.commission_rate}%)`,
      value: money(f.commission.total),
      sub: `Bugun ${money(f.commission.today)} · Hafta ${money(f.commission.this_week)}`,
      icon: icons.receipt,
    },
    {
      label: "Muvaffaqiyatli to'lovlar",
      value: f.transactions.payments_successful,
      sub: `Jami ${f.transactions.payments_total}`,
      icon: icons.verified,
    },
    {
      label: "Amalga oshmagan to'lovlar",
      value: f.transactions.payments_failed,
      icon: icons.error,
      alert: f.transactions.payments_failed > 0,
    },
    {
      label: 'Qaytarilgan to\'lovlar',
      value: f.transactions.refunds,
      sub: `${money(f.commission.reversed)} komissiya bekor qilindi`,
      icon: icons.refund,
    },
    {
      label: 'Hamyon operatsiyalari',
      value: f.transactions.wallet_movements,
      icon: icons.receipt,
    },
  ]
})

const charts = computed(() => {
  const s = series.value
  const f = finance.value

  if (!s || !f) return []

  const label = `${f.test_mode ? 'TEST ' : ''}${f.currency}`

  return [
    {
      title: "Kunlik ro'yxatdan o'tish",
      points: s.points.map((p) => p.registrations),
      caption: `Jami ${s.points.reduce((sum, p) => sum + p.registrations, 0)} ta`,
    },
    {
      title: 'Kunlik test hajmi',
      points: s.points.map((p) => p.test_volume),
      caption: `Jami ${formatAmount(
        s.points.reduce((sum, p) => sum + p.test_volume, 0),
        f.currency,
      )} ${label}`,
    },
    {
      title: 'Kunlik komissiya',
      points: s.points.map((p) => p.commission),
      caption: `Jami ${formatAmount(
        s.points.reduce((sum, p) => sum + p.commission, 0),
        f.currency,
      )} ${label}`,
    },
  ]
})

async function load() {
  loading.value = true
  hasError.value = false

  try {
    const { data } = await adminApi.dashboard(Number(range.value))
    stats.value = data.data
    finance.value = data.finance
    series.value = data.series
  } catch {
    hasError.value = true
  } finally {
    loading.value = false
  }
}

function setRange(value: string) {
  range.value = value
  void load()
}

onMounted(load)
</script>

<template>
  <AdminLayout>
    <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
      <h1 class="text-2xl font-bold text-ink">Dashboard</h1>
      <AppTabs :tabs="rangeTabs" :model-value="range" @update:model-value="setRange" />
    </div>

    <div v-if="loading" class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div v-for="i in 8" :key="i" class="card p-5 space-y-3">
        <Skeleton variant="circle" width="1.5rem" height="1.5rem" />
        <Skeleton variant="text" width="50%" />
        <Skeleton variant="text" width="70%" />
      </div>
    </div>

    <ErrorState v-else-if="hasError" @retry="load" />

    <template v-else-if="stats && finance">
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          v-for="card in operationalCards"
          :key="card.label"
          class="card p-5"
          :class="card.alert ? 'ring-2 ring-danger/30' : ''"
        >
          <span
            class="w-9 h-9 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center mb-2"
          >
            <FontAwesomeIcon :icon="card.icon" />
          </span>
          <p class="text-2xl font-bold text-ink break-words">{{ card.value }}</p>
          <p class="text-sm text-ink-muted mt-1">{{ card.label }}</p>
          <p v-if="card.sub" class="text-xs text-ink-faint mt-1.5 leading-relaxed">{{ card.sub }}</p>
        </div>
      </div>

      <!-- The financial band. Its banner is the first thing in it, because an
           administrator reading a revenue figure has to know what kind of money
           it is before they read the number. -->
      <div class="mt-8">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 class="text-lg font-bold text-ink">Moliya</h2>
          <span class="text-xs text-ink-faint">Provayder: {{ finance.gateway }}</span>
        </div>

        <div
          v-if="finance.test_mode"
          class="rounded-2xl border border-warning/30 bg-warning-bg px-4 py-3 flex items-start gap-3 mb-4"
          data-testid="admin-test-mode-banner"
        >
          <FontAwesomeIcon :icon="icons.testMode" class="text-warning mt-0.5 shrink-0" />
          <div class="min-w-0">
            <p class="text-sm font-bold text-ink">MOCK PAYMENT ENVIRONMENT</p>
            <p class="text-xs text-ink-secondary leading-relaxed mt-0.5">
              Quyidagi barcha summalar simulyatsiya. Haqiqiy pul harakati yo'q — to'lov provayderi
              ulanmagan.
            </p>
          </div>
        </div>

        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            v-for="card in financialCards"
            :key="card.label"
            class="card p-5"
            :class="card.alert ? 'ring-2 ring-danger/30' : ''"
          >
            <span
              class="w-9 h-9 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center mb-2"
            >
              <FontAwesomeIcon :icon="card.icon" />
            </span>
            <p class="text-xl font-bold text-ink break-words">{{ card.value }}</p>
            <p class="text-sm text-ink-muted mt-1">{{ card.label }}</p>
            <p v-if="card.sub" class="text-xs text-ink-faint mt-1.5 leading-relaxed">{{ card.sub }}</p>
          </div>
        </div>
      </div>

      <div class="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div v-for="chart in charts" :key="chart.title" class="card p-5">
          <p class="text-sm font-semibold text-ink mb-3">{{ chart.title }}</p>
          <SparkChart :points="chart.points" :caption="chart.caption" />
        </div>
      </div>
    </template>
  </AdminLayout>
</template>
