<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import AppLayout from '@/layouts/AppLayout.vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { walletApi } from '@/api/wallet'
import { useAuthStore } from '@/stores/auth'
import { useEchoChannel } from '@/composables/useEchoChannel'
import { onEchoReconnect } from '@/composables/useEcho'
import { useToast } from '@/composables/useToast'
import { extractErrorMessage } from '@/composables/useApiError'
import { icons } from '@/lib/icons'
import type { Wallet, WalletTransaction } from '@/types'
import { formatDate, formatNumber } from '@/lib/datetime'

const auth = useAuthStore()
const toast = useToast()

const wallet = ref<Wallet | null>(null)
const transactions = ref<WalletTransaction[]>([])
const loading = ref(true)
const hasError = ref(false)
const showWithdraw = ref(false)
const amount = ref('')
const withdrawing = ref(false)
const error = ref('')

const canWithdraw = computed(
  () => !!wallet.value && wallet.value.available_balance >= wallet.value.min_withdrawal,
)

const format = formatNumber

/** Ledger rows are the only record of where money moved, so label them plainly. */
function transactionLabel(tx: WalletTransaction): string {
  if (tx.description) return tx.description

  switch (tx.reference_type) {
    case 'payment':
      return 'Komissiya qaytarildi'
    case 'invoice':
      return "Komissiya to'lovi"
    case 'withdrawal':
      return 'Pul yechish'
    default:
      return tx.type === 'credit' ? 'Kirim' : 'Chiqim'
  }
}

async function load() {
  loading.value = true
  hasError.value = false
  try {
    const [walletRes, txRes] = await Promise.all([walletApi.show(), walletApi.transactions()])
    wallet.value = walletRes.data.data
    transactions.value = txRes.data.data
  } catch {
    hasError.value = true
  } finally {
    loading.value = false
  }
}

async function withdraw() {
  error.value = ''
  withdrawing.value = true
  try {
    await walletApi.withdraw(Number(amount.value))
    showWithdraw.value = false
    amount.value = ''
    await load()
  } catch (e) {
    error.value = extractErrorMessage(e)
  } finally {
    withdrawing.value = false
  }
}

/**
 * Live balance.
 *
 * Wallet movements ride the user's own private channel rather than a
 * `wallet.{id}` one: the audience is identical, and a second channel would be
 * a second authorisation callback to get wrong.
 *
 * The event carries the authoritative balance, so the figures are applied
 * directly instead of re-fetching. The transaction row is prepended when it is
 * new — a refund produces one event, and the ledger should show it at once.
 */
useEchoChannel(() => (auth.user ? `App.Models.User.${auth.user.id}` : null), {
  listeners: {
    '.WalletUpdated': (payload: {
      balance: number
      pending_balance: number
      transaction: WalletTransaction | null
    }) => {
      if (wallet.value) {
        wallet.value.balance = payload.balance
        wallet.value.pending_balance = payload.pending_balance
        wallet.value.available_balance = payload.balance
        wallet.value.total_balance = payload.balance + payload.pending_balance
      }

      if (payload.transaction && !transactions.value.some((t) => t.id === payload.transaction!.id)) {
        transactions.value.unshift(payload.transaction)
      }
    },

    '.PaymentRefunded': (payload: { amount: number }) => {
      toast.success(`${format(payload.amount)} UZS hamyoningizga qaytarildi.`)
    },
  },
})

// Balance changes during a dropped connection are simply missed.
onEchoReconnect(() => void load())

onMounted(load)
</script>

<template>
  <AppLayout>
    <div class="px-4 md:px-8 pt-6 md:pt-8 max-w-xl pb-8">
      <h1 class="text-xl font-bold text-ink mb-5">Hamyon</h1>

      <div v-if="loading" class="space-y-6">
        <Skeleton variant="block" height="9rem" class="rounded-2xl" />
        <div class="space-y-2">
          <div v-for="i in 3" :key="i" class="card p-4 space-y-2">
            <Skeleton variant="text" width="50%" />
            <Skeleton variant="text" width="30%" />
          </div>
        </div>
      </div>

      <ErrorState v-else-if="hasError" @retry="load" />

      <template v-else-if="wallet">
        <div class="rounded-2xl bg-gradient-to-br from-primary-600 to-primary-800 text-white p-6">
          <p class="text-primary-100 text-sm">Mavjud balans</p>
          <p class="text-3xl font-bold mt-1">{{ format(wallet.available_balance) }} {{ wallet.currency }}</p>

          <div v-if="wallet.pending_balance > 0" class="mt-3 pt-3 border-t border-white/20 space-y-1">
            <p class="text-primary-100 text-sm flex items-center justify-between">
              <span>Yechish jarayonida</span>
              <span class="font-medium">{{ format(wallet.pending_balance) }}</span>
            </p>
            <p class="text-primary-100 text-sm flex items-center justify-between">
              <span>Jami</span>
              <span class="font-medium">{{ format(wallet.total_balance) }}</span>
            </p>
          </div>

          <button
            class="mt-4 h-10 px-5 rounded-xl bg-white/15 hover:bg-white/25 transition text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!canWithdraw"
            @click="showWithdraw = true"
          >
            Pul yechish
          </button>
          <p v-if="!canWithdraw" class="text-primary-100 text-xs mt-2">
            Eng kam yechish summasi {{ format(wallet.min_withdrawal) }} {{ wallet.currency }}.
          </p>
        </div>

        <h2 class="font-semibold text-ink mt-6 mb-3">Tranzaksiyalar</h2>
        <EmptyState
          v-if="transactions.length === 0"
          :icon="icons.amount"
          title="Hozircha tranzaksiyalar yo'q"
          description="Bekor qilingan faoliyat uchun qaytarilgan komissiya shu yerda ko'rinadi."
        />
        <div v-else class="space-y-2">
          <div v-for="tx in transactions" :key="tx.id" class="card p-4 flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm font-medium text-ink truncate">{{ transactionLabel(tx) }}</p>
              <p class="text-xs text-ink-faint">
                {{ formatDate(tx.created_at) }} · Balans:
                {{ format(tx.balance_after) }}
              </p>
            </div>
            <span class="font-semibold shrink-0" :class="tx.type === 'credit' ? 'text-success' : 'text-danger'">
              {{ tx.type === 'credit' ? '+' : '−' }}{{ format(tx.amount) }}
            </span>
          </div>
        </div>
      </template>
    </div>

    <AppModal v-if="showWithdraw && wallet" title="Pul yechish" @close="showWithdraw = false">
      <p class="text-sm text-ink-secondary mb-3">
        Mavjud: {{ format(wallet.available_balance) }} {{ wallet.currency }} · eng kam
        {{ format(wallet.min_withdrawal) }} {{ wallet.currency }}
      </p>
      <AppInput v-model="amount" label="Summa (UZS)" type="number" placeholder="50000" />
      <p v-if="error" class="text-sm text-danger mt-2">{{ error }}</p>
      <AppButton class="mt-4" :loading="withdrawing" @click="withdraw">Yechish</AppButton>
    </AppModal>
  </AppLayout>
</template>
