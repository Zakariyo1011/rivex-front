<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import AppSearchInput from '@/components/ui/AppSearchInput.vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import Pagination from '@/components/ui/Pagination.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { adminFinanceApi } from '@/api/admin'
import { useAdminStore } from '@/stores/admin'
import { useToast } from '@/composables/useToast'
import { extractErrorMessage } from '@/composables/useApiError'
import { icons } from '@/lib/icons'
import { parseAmount } from '@/lib/money'
import type { AdminWalletRow } from '@/types'

/**
 * Every user wallet, with the totals behind each balance.
 *
 * The adjustment control is rendered only for admins holding `finance.adjust`
 * — but that is presentation, not security: the endpoint refuses anyone else
 * regardless. Showing it to someone who cannot use it would produce a 403 they
 * have no way to interpret.
 *
 * An adjustment writes a normal ledger row and demands a reason, because a
 * balance change with no explanation is the one entry nobody can reconstruct
 * later.
 */
const admin = useAdminStore()
const toast = useToast()

const rows = ref<AdminWalletRow[]>([])
const testMode = ref(false)
const loading = ref(true)
const hasError = ref(false)
const page = ref(1)
const lastPage = ref(1)
const total = ref(0)
const query = ref('')

const adjusting = ref<AdminWalletRow | null>(null)
const adjustAmount = ref('')
const adjustReason = ref('')
const adjustBusy = ref(false)
const adjustError = ref('')

async function load() {
  loading.value = true
  hasError.value = false

  try {
    const { data } = await adminFinanceApi.wallets({ q: query.value || undefined, page: page.value })

    rows.value = data.data
    testMode.value = data.test_mode
    lastPage.value = data.meta.last_page
    total.value = data.meta.total
  } catch {
    hasError.value = true
  } finally {
    loading.value = false
  }
}

function openAdjust(row: AdminWalletRow) {
  adjusting.value = row
  adjustAmount.value = ''
  adjustReason.value = ''
  adjustError.value = ''
}

async function submitAdjust() {
  const row = adjusting.value
  const amount = parseAmount(adjustAmount.value.replace('-', ''))

  if (!row || amount === null || amount === 0 || adjustReason.value.trim().length < 3) return

  adjustError.value = ''
  adjustBusy.value = true

  const signed = adjustAmount.value.trim().startsWith('-') ? -amount : amount

  try {
    const { data } = await adminFinanceApi.adjust(row.user.id as number, signed, adjustReason.value)
    toast.success(data.message)
    adjusting.value = null
    await load()
  } catch (e) {
    adjustError.value = extractErrorMessage(e)
  } finally {
    adjustBusy.value = false
  }
}

watch(query, () => {
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
        <h1 class="text-2xl font-bold text-ink">Hamyonlar</h1>
        <p class="text-sm text-ink-muted mt-0.5">{{ total }} ta hamyon</p>
      </div>

      <span
        v-if="testMode"
        class="text-xs font-bold px-3 py-1.5 rounded-full bg-warning-bg text-warning inline-flex items-center gap-1.5"
      >
        <FontAwesomeIcon :icon="icons.testMode" />
        TEST DATA
      </span>
    </div>

    <AppSearchInput
      v-model="query"
      placeholder="Ism, username, email yoki telefon bo'yicha qidirish"
      class="mb-4"
    />

    <div v-if="loading" class="space-y-2">
      <div v-for="i in 6" :key="i" class="card p-4 space-y-2">
        <Skeleton variant="text" width="40%" />
        <Skeleton variant="text" width="60%" />
      </div>
    </div>

    <ErrorState v-else-if="hasError" @retry="load" />

    <EmptyState
      v-else-if="rows.length === 0"
      :icon="icons.wallet"
      title="Hamyonlar topilmadi"
      description="Qidiruvni o'zgartirib ko'ring."
    />

    <template v-else>
      <div class="hidden md:block card overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-surface-muted text-ink-muted">
              <tr>
                <th class="text-left font-medium px-4 py-3">Foydalanuvchi</th>
                <th class="text-right font-medium px-4 py-3">Balans</th>
                <th class="text-right font-medium px-4 py-3">Yechishda</th>
                <th class="text-right font-medium px-4 py-3">Jami to'ldirilgan</th>
                <th class="text-right font-medium px-4 py-3">Sarflangan</th>
                <th class="text-right font-medium px-4 py-3">Operatsiyalar</th>
                <th v-if="admin.can('finance.adjust')" class="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border">
              <tr v-for="row in rows" :key="row.id" class="hover:bg-surface-muted/60">
                <td class="px-4 py-3">
                  <span class="font-medium text-ink">{{ row.user.name ?? '—' }}</span>
                  <span v-if="row.user.username" class="block text-xs text-ink-faint">
                    @{{ row.user.username }}
                  </span>
                </td>
                <td class="px-4 py-3 text-right font-semibold text-ink whitespace-nowrap">
                  {{ row.balance.formatted }}
                </td>
                <td class="px-4 py-3 text-right text-ink-muted whitespace-nowrap">
                  {{ row.pending_balance.formatted }}
                </td>
                <td class="px-4 py-3 text-right text-ink-muted whitespace-nowrap">
                  {{ row.total_top_ups.formatted }}
                </td>
                <td class="px-4 py-3 text-right text-ink-muted whitespace-nowrap">
                  {{ row.total_spent.formatted }}
                </td>
                <td class="px-4 py-3 text-right text-ink-muted">{{ row.transactions_count }}</td>
                <td v-if="admin.can('finance.adjust')" class="px-4 py-3 text-right">
                  <button
                    class="text-sm text-primary-600 font-medium hover:underline"
                    @click="openAdjust(row)"
                  >
                    Tuzatish
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="md:hidden space-y-2">
        <div v-for="row in rows" :key="row.id" class="card p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="font-medium text-ink truncate">{{ row.user.name ?? '—' }}</p>
              <p v-if="row.user.username" class="text-xs text-ink-faint truncate">
                @{{ row.user.username }}
              </p>
            </div>
            <p class="font-semibold text-ink shrink-0">{{ row.balance.formatted }}</p>
          </div>

          <dl class="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-y-1.5 text-xs">
            <dt class="text-ink-faint">Jami to'ldirilgan</dt>
            <dd class="text-ink-secondary text-right">{{ row.total_top_ups.formatted }}</dd>

            <dt class="text-ink-faint">Sarflangan</dt>
            <dd class="text-ink-secondary text-right">{{ row.total_spent.formatted }}</dd>

            <dt class="text-ink-faint">Yechishda</dt>
            <dd class="text-ink-secondary text-right">{{ row.pending_balance.formatted }}</dd>

            <dt class="text-ink-faint">Operatsiyalar</dt>
            <dd class="text-ink-secondary text-right">{{ row.transactions_count }}</dd>
          </dl>

          <button
            v-if="admin.can('finance.adjust')"
            class="mt-3 text-sm text-primary-600 font-medium"
            @click="openAdjust(row)"
          >
            Balansni tuzatish
          </button>
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

    <AppModal v-if="adjusting" title="Balansni tuzatish" @close="adjusting = null">
      <p class="text-sm text-ink-secondary mb-3">
        <span class="font-medium text-ink">{{ adjusting.user.name }}</span> —
        joriy balans {{ adjusting.balance.formatted }}.
      </p>

      <AppInput
        v-model="adjustAmount"
        label="Summa"
        placeholder="25000 yoki -25000"
        inputmode="text"
        hint="Musbat — qo'shish, manfiy — ayirish"
      />

      <AppInput
        v-model="adjustReason"
        label="Sabab"
        placeholder="Qo'llab-quvvatlash tuzatishi"
        class="mt-3"
      />

      <p class="text-xs text-ink-faint mt-3 leading-relaxed">
        Tuzatish oddiy hamyon yozuvi sifatida qayd etiladi va audit jurnaliga tushadi.
        Hech qanday yozuv o'chirilmaydi.
      </p>

      <p v-if="adjustError" class="text-sm text-danger mt-2">{{ adjustError }}</p>

      <AppButton
        class="mt-4"
        :loading="adjustBusy"
        :disabled="!parseAmount(adjustAmount.replace('-', '')) || adjustReason.trim().length < 3"
        @click="submitAdjust"
      >
        Tuzatishni saqlash
      </AppButton>
    </AppModal>
  </AdminLayout>
</template>
