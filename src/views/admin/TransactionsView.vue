<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import AppSearchInput from '@/components/ui/AppSearchInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppInput from '@/components/ui/AppInput.vue'
import Pagination from '@/components/ui/Pagination.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { adminFinanceApi } from '@/api/admin'
import { icons } from '@/lib/icons'
import { formatDate, formatTime } from '@/lib/datetime'
import { formatAmount, formatSigned } from '@/lib/money'
import type { AdminWalletTransaction, TransactionFilters } from '@/types'

/**
 * The platform ledger.
 *
 * A table on desktop and a stack of cards below `md`, because a seven-column
 * financial table on a phone is either unreadable or horizontally scrolled —
 * and the row a support agent needs is usually identified by who and how much,
 * not by scanning a grid.
 *
 * Search covers the four things somebody actually arrives holding: a handle,
 * an email, a transaction id, and the idempotency reference. Filters are
 * server-side — a client-side filter over one page of results answers a
 * different question from the one being asked.
 */
const rows = ref<AdminWalletTransaction[]>([])
const filters = ref<TransactionFilters | null>(null)
const testMode = ref(false)
const loading = ref(true)
const hasError = ref(false)
const page = ref(1)
const lastPage = ref(1)
const total = ref(0)

const query = ref('')

// `null`, not `''`: AppSelect emits null for its empty option, and typing these
// as plain strings is how a "clear the filter" click ends up sending the string
// "null" to the API.
const type = ref<string | null>(null)
const direction = ref<string | null>(null)
const from = ref('')
const to = ref('')

const typeOptions = computed(() => [
  { value: null, label: 'Barcha turlar' },
  ...(filters.value?.types ?? []).map((t) => ({ value: t.value, label: t.label })),
])

const directionOptions = [
  { value: null, label: 'Barchasi' },
  { value: 'credit', label: 'Kirim' },
  { value: 'debit', label: 'Chiqim' },
]

const hasFilters = computed(
  () => !!(query.value || type.value || direction.value || from.value || to.value),
)

async function load() {
  loading.value = true
  hasError.value = false

  try {
    const { data } = await adminFinanceApi.transactions({
      q: query.value || undefined,
      type: (type.value || undefined) as never,
      direction: (direction.value || undefined) as never,
      from: from.value || undefined,
      to: to.value || undefined,
      page: page.value,
    })

    rows.value = data.data
    filters.value = data.filters
    testMode.value = data.test_mode
    lastPage.value = data.meta.last_page
    total.value = data.meta.total
  } catch {
    hasError.value = true
  } finally {
    loading.value = false
  }
}

function reset() {
  query.value = ''
  type.value = null
  direction.value = null
  from.value = ''
  to.value = ''
}

// Any filter change starts again at page one — staying on page 4 of a result
// set that now has two pages shows an empty table and reads as a broken screen.
watch([query, type, direction, from, to], () => {
  page.value = 1
  void load()
})

watch(page, () => void load())

onMounted(load)
</script>

<template>
  <AdminLayout>
    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div>
        <h1 class="text-2xl font-bold text-ink">Tranzaksiyalar</h1>
        <p class="text-sm text-ink-muted mt-0.5">{{ total }} ta yozuv</p>
      </div>

      <span
        v-if="testMode"
        class="text-xs font-bold px-3 py-1.5 rounded-full bg-warning-bg text-warning inline-flex items-center gap-1.5"
      >
        <FontAwesomeIcon :icon="icons.testMode" />
        TEST DATA
      </span>
    </div>

    <div class="card p-4 mb-4 space-y-3">
      <AppSearchInput
        v-model="query"
        placeholder="Username, email, ID yoki reference bo'yicha qidirish"
      />

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <AppSelect v-model="type" label="Turi" :options="typeOptions" />
        <AppSelect v-model="direction" label="Yo'nalish" :options="directionOptions" />
        <AppInput v-model="from" label="Boshlanish" type="date" />
        <AppInput v-model="to" label="Tugash" type="date" />
      </div>

      <button
        v-if="hasFilters"
        type="button"
        class="text-sm text-primary-600 font-medium"
        @click="reset"
      >
        Filtrlarni tozalash
      </button>
    </div>

    <div v-if="loading" class="space-y-2">
      <div v-for="i in 6" :key="i" class="card p-4 space-y-2">
        <Skeleton variant="text" width="40%" />
        <Skeleton variant="text" width="60%" />
      </div>
    </div>

    <ErrorState v-else-if="hasError" @retry="load" />

    <EmptyState
      v-else-if="rows.length === 0"
      :icon="icons.receipt"
      title="Tranzaksiyalar topilmadi"
      description="Filtrlarni o'zgartirib ko'ring."
    />

    <template v-else>
      <!-- Desktop: a table, because comparing rows is the point. -->
      <div class="hidden md:block card overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-surface-muted text-ink-muted">
              <tr>
                <th class="text-left font-medium px-4 py-3">ID</th>
                <th class="text-left font-medium px-4 py-3">Foydalanuvchi</th>
                <th class="text-left font-medium px-4 py-3">Turi</th>
                <th class="text-right font-medium px-4 py-3">Summa</th>
                <th class="text-left font-medium px-4 py-3">Valyuta</th>
                <th class="text-left font-medium px-4 py-3">Holat</th>
                <th class="text-left font-medium px-4 py-3">Reference</th>
                <th class="text-left font-medium px-4 py-3">Sana</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border">
              <tr v-for="row in rows" :key="row.id" class="hover:bg-surface-muted/60">
                <td class="px-4 py-3 text-ink-faint">#{{ row.id }}</td>
                <td class="px-4 py-3">
                  <RouterLink
                    v-if="row.user"
                    :to="{ name: 'admin-users', query: { q: row.user.username ?? row.user.email ?? '' } }"
                    class="text-ink font-medium hover:text-primary-600"
                  >
                    {{ row.user.name }}
                    <span v-if="row.user.username" class="block text-xs text-ink-faint">
                      @{{ row.user.username }}
                    </span>
                  </RouterLink>
                  <span v-else class="text-ink-faint">—</span>
                </td>
                <td class="px-4 py-3">
                  <span class="text-ink">{{ row.type_label }}</span>
                  <span class="block text-xs text-ink-faint">{{ row.description }}</span>
                </td>
                <td
                  class="px-4 py-3 text-right font-semibold whitespace-nowrap"
                  :class="row.direction === 'credit' ? 'text-success' : 'text-ink'"
                >
                  {{ formatSigned(row.amount, row.direction, row.currency) }}
                </td>
                <td class="px-4 py-3 text-ink-muted whitespace-nowrap">
                  {{ testMode ? 'TEST ' : '' }}{{ row.currency }}
                </td>
                <td class="px-4 py-3">
                  <span
                    class="text-xs font-medium px-2 py-0.5 rounded-full"
                    :class="
                      row.status === 'completed'
                        ? 'bg-success-bg text-success'
                        : 'bg-surface-muted text-ink-muted'
                    "
                  >
                    {{ row.status }}
                  </span>
                </td>
                <td class="px-4 py-3 text-xs text-ink-faint max-w-[14rem] truncate">
                  {{ row.reference ?? '—' }}
                </td>
                <td class="px-4 py-3 text-ink-muted whitespace-nowrap">
                  {{ formatDate(row.created_at) }}
                  <span class="block text-xs text-ink-faint">{{ formatTime(row.created_at) }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Mobile: cards. Same data, ordered by what is actually looked for. -->
      <div class="md:hidden space-y-2">
        <div v-for="row in rows" :key="row.id" class="card p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="font-medium text-ink truncate">{{ row.type_label }}</p>
              <p v-if="row.user" class="text-xs text-ink-muted truncate">
                {{ row.user.name }}
                <span v-if="row.user.username">· @{{ row.user.username }}</span>
              </p>
            </div>
            <p
              class="font-semibold shrink-0"
              :class="row.direction === 'credit' ? 'text-success' : 'text-ink'"
            >
              {{ formatSigned(row.amount, row.direction, row.currency) }}
            </p>
          </div>

          <dl class="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-y-1.5 text-xs">
            <dt class="text-ink-faint">ID</dt>
            <dd class="text-ink-secondary text-right">#{{ row.id }}</dd>

            <dt class="text-ink-faint">Valyuta</dt>
            <dd class="text-ink-secondary text-right">
              {{ testMode ? 'TEST ' : '' }}{{ row.currency }}
            </dd>

            <dt class="text-ink-faint">Balans</dt>
            <dd class="text-ink-secondary text-right">
              {{ formatAmount(row.balance_after, row.currency) }}
            </dd>

            <dt class="text-ink-faint">Holat</dt>
            <dd class="text-ink-secondary text-right">{{ row.status }}</dd>

            <dt class="text-ink-faint">Sana</dt>
            <dd class="text-ink-secondary text-right">
              {{ formatDate(row.created_at) }}, {{ formatTime(row.created_at) }}
            </dd>
          </dl>

          <p v-if="row.reference" class="text-[0.65rem] text-ink-faint mt-2 truncate">
            {{ row.reference }}
          </p>
        </div>
      </div>

      <Pagination
        v-if="lastPage > 1"
        :current-page="page"
        :last-page="lastPage"
        class="mt-4"
        @update:current-page="page = $event"
      />
    </template>
  </AdminLayout>
</template>
