<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import Avatar from '@/components/ui/Avatar.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import AppDrawer from '@/components/ui/AppDrawer.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { adminApi, adminFinanceApi } from '@/api/admin'
import { useAdminStore } from '@/stores/admin'
import { icons } from '@/lib/icons'
import { formatDate, formatTime } from '@/lib/datetime'
import { formatSigned } from '@/lib/money'
import { useRoute } from 'vue-router'
import type { AdminUserFinancials, AdminWalletTransaction, User } from '@/types'

const route = useRoute()
const admin = useAdminStore()

const users = ref<User[]>([])

/**
 * The financial side of one user, opened in a drawer rather than a page.
 *
 * A drawer because it is a lookup, not a destination: the question being asked
 * is "what happened to this person's money" while working through a list, and
 * a full navigation loses the list and its filters.
 *
 * Only fetched for admins holding `finance.view` — the endpoint refuses anyone
 * else, and requesting it just to render a 403 would be noise in the logs.
 */
const financialsFor = ref<User | null>(null)
const financials = ref<AdminUserFinancials | null>(null)
const financialTransactions = ref<AdminWalletTransaction[]>([])
const financialsLoading = ref(false)
const loading = ref(true)
const hasError = ref(false)
const search = ref('')
const statusFilter = ref('')
const actingId = ref<number | null>(null)

const statusLabels: Record<string, string> = {
  active: 'Faol',
  suspended: 'Muzlatilgan',
  banned: 'Bloklangan',
}

const statusVariants: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  active: 'success',
  suspended: 'warning',
  banned: 'danger',
}

async function load() {
  loading.value = true
  hasError.value = false
  try {
    const { data } = await adminApi.users({ q: search.value || undefined, status: statusFilter.value || undefined })
    users.value = data.data
  } catch {
    hasError.value = true
  } finally {
    loading.value = false
  }
}

async function openFinancials(user: User) {
  financialsFor.value = user
  financials.value = null
  financialTransactions.value = []
  financialsLoading.value = true

  try {
    const { data } = await adminFinanceApi.userFinancials(user.id)
    financials.value = data.data
    financialTransactions.value = data.transactions.data
  } finally {
    financialsLoading.value = false
  }
}

async function setStatus(user: User, status: 'active' | 'suspended' | 'banned') {
  actingId.value = user.id
  try {
    const { data } = await adminApi.updateUserStatus(user.id, status)
    const index = users.value.findIndex((u) => u.id === user.id)
    if (index !== -1) users.value[index] = data.data
  } finally {
    actingId.value = null
  }
}

let searchTimeout: ReturnType<typeof setTimeout>
function onSearchInput() {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(load, 350)
}

onMounted(() => {
  // Deep-linked from the transactions table: "who is this row about".
  if (typeof route.query.q === 'string') search.value = route.query.q

  void load()
})
</script>

<template>
  <AdminLayout>
    <h1 class="text-2xl font-bold text-ink mb-6">Foydalanuvchilar</h1>

    <div class="flex gap-3 mb-5">
      <input
        v-model="search"
        type="text"
        placeholder="Ism yoki telefon bo'yicha qidirish..."
        class="h-10 flex-1 max-w-sm px-4 rounded-xl border border-border bg-surface text-sm outline-none focus:ring-2 focus:ring-primary-100"
        @input="onSearchInput"
      />
      <select
        v-model="statusFilter"
        class="h-10 px-3 rounded-xl border border-border bg-surface text-sm outline-none"
        @change="load"
      >
        <option value="">Barcha holatlar</option>
        <option value="active">Faol</option>
        <option value="suspended">Muzlatilgan</option>
        <option value="banned">Bloklangan</option>
      </select>
    </div>

    <div class="card overflow-hidden">
      <div class="overflow-x-auto">
      <table class="w-full text-sm min-w-[640px]">
        <thead>
          <tr class="border-b border-border text-left text-ink-faint">
            <th class="px-5 py-3 font-medium">Foydalanuvchi</th>
            <th class="px-5 py-3 font-medium">Aloqa</th>
            <th class="px-5 py-3 font-medium">Holat</th>
            <th class="px-5 py-3 font-medium">Tasdiqlangan</th>
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
          <tr v-else-if="users.length === 0">
            <td colspan="5" class="px-5 py-8 text-center text-ink-faint">Foydalanuvchi topilmadi.</td>
          </tr>
          <tr v-for="user in users" :key="user.id" class="border-b border-border last:border-0">
            <td class="px-5 py-3">
              <div class="flex items-center gap-2.5">
                <Avatar :src="user.profile.avatar_url" :name="user.name" size="sm" />
                <RouterLink :to="{ name: 'user-profile', params: { id: user.id } }" class="font-medium text-ink hover:text-primary-600">
                  {{ user.name }}
                </RouterLink>
              </div>
            </td>
            <td class="px-5 py-3 text-ink-muted">
              <!-- Google is how accounts exist now, so the email is the
                   identifier support is given. The phone is often absent. -->
              <span class="block truncate max-w-[14rem]">{{ user.email ?? '—' }}</span>
              <span class="block text-xs text-ink-faint">{{ user.phone ?? 'Telefon yo\'q' }}</span>
            </td>
            <td class="px-5 py-3">
              <StatusBadge :status="user.status" :labels="statusLabels" :variants="statusVariants" />
            </td>
            <td class="px-5 py-3">
              <FontAwesomeIcon v-if="user.identity_verified" :icon="icons.verified" class="text-primary-500" />
              <span v-else class="text-ink-faint">—</span>
            </td>
            <td class="px-5 py-3 text-right space-x-2">
              <button
                v-if="admin.can('finance.view')"
                class="text-xs font-medium text-primary-600"
                @click="openFinancials(user)"
              >
                Moliya
              </button>
              <button
                v-if="user.status !== 'suspended'"
                class="text-xs font-medium text-warning disabled:opacity-50"
                :disabled="actingId === user.id"
                @click="setStatus(user, 'suspended')"
              >
                Muzlatish
              </button>
              <button
                v-if="user.status !== 'banned'"
                class="text-xs font-medium text-danger disabled:opacity-50"
                :disabled="actingId === user.id"
                @click="setStatus(user, 'banned')"
              >
                Bloklash
              </button>
              <button
                v-if="user.status !== 'active'"
                class="text-xs font-medium text-success disabled:opacity-50"
                :disabled="actingId === user.id"
                @click="setStatus(user, 'active')"
              >
                Faollashtirish
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>

    <AppDrawer
      v-if="financialsFor"
      :title="`${financialsFor.name} — moliya`"
      @close="financialsFor = null"
    >
      <div v-if="financialsLoading" class="space-y-3">
        <Skeleton variant="block" height="5rem" class="rounded-xl" />
        <Skeleton variant="text" width="60%" />
        <Skeleton variant="text" width="40%" />
      </div>

      <div v-else-if="financials" class="space-y-4">
        <div
          v-if="financials.test_mode"
          class="rounded-xl border border-warning/30 bg-warning-bg px-3 py-2 text-xs text-ink-secondary flex items-center gap-2"
        >
          <FontAwesomeIcon :icon="icons.testMode" class="text-warning" />
          TEST DATA — barcha summalar simulyatsiya
        </div>

        <dl class="grid grid-cols-2 gap-3">
          <div class="card p-3">
            <dt class="text-xs text-ink-faint">Balans</dt>
            <dd class="font-bold text-ink mt-0.5">{{ financials.wallet.balance.formatted }}</dd>
          </div>
          <div class="card p-3">
            <dt class="text-xs text-ink-faint">Yechishda</dt>
            <dd class="font-bold text-ink mt-0.5">
              {{ financials.wallet.pending_balance.formatted }}
            </dd>
          </div>
          <div class="card p-3">
            <dt class="text-xs text-ink-faint">Jami to'ldirilgan</dt>
            <dd class="font-bold text-ink mt-0.5">{{ financials.totals.test_top_ups.formatted }}</dd>
          </div>
          <div class="card p-3">
            <dt class="text-xs text-ink-faint">Sarflangan</dt>
            <dd class="font-bold text-ink mt-0.5">{{ financials.totals.spent.formatted }}</dd>
          </div>
          <div class="card p-3">
            <dt class="text-xs text-ink-faint">Qaytarilgan</dt>
            <dd class="font-bold text-ink mt-0.5">{{ financials.totals.refunded.formatted }}</dd>
          </div>
          <div class="card p-3">
            <dt class="text-xs text-ink-faint">Rivex komissiyasi</dt>
            <dd class="font-bold text-ink mt-0.5">
              {{ financials.totals.commission_generated.formatted }}
            </dd>
          </div>
        </dl>

        <p class="text-xs text-ink-faint">
          {{ financials.counts.payments_successful }} muvaffaqiyatli to'lov ·
          {{ financials.counts.refunds }} qaytarish ·
          {{ financials.counts.wallet_transactions }} hamyon operatsiyasi
        </p>

        <div>
          <h3 class="font-semibold text-ink mb-2">Tranzaksiyalar tarixi</h3>

          <EmptyState
            v-if="financialTransactions.length === 0"
            :icon="icons.receipt"
            title="Operatsiyalar yo'q"
          />

          <div v-else class="card divide-y divide-border">
            <div
              v-for="tx in financialTransactions"
              :key="tx.id"
              class="px-3 py-2.5 flex items-center justify-between gap-3"
            >
              <div class="min-w-0">
                <p class="text-sm text-ink truncate">{{ tx.description || tx.type_label }}</p>
                <p class="text-xs text-ink-faint">
                  {{ formatDate(tx.created_at) }}, {{ formatTime(tx.created_at) }}
                </p>
              </div>
              <p
                class="text-sm font-semibold shrink-0"
                :class="tx.direction === 'credit' ? 'text-success' : 'text-ink'"
              >
                {{ formatSigned(tx.amount, tx.direction, tx.currency) }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppDrawer>
  </AdminLayout>
</template>
