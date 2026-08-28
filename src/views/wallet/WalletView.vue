<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import AppLayout from '@/layouts/AppLayout.vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import TestModeBanner from '@/components/wallet/TestModeBanner.vue'
import TransactionRow from '@/components/wallet/TransactionRow.vue'
import { walletApi } from '@/api/wallet'
import { paymentKey } from '@/api/invoices'
import { useAuthStore } from '@/stores/auth'
import { useEchoChannel } from '@/composables/useEchoChannel'
import { onEchoReconnect } from '@/composables/useEcho'
import { useToast } from '@/composables/useToast'
import { extractErrorMessage } from '@/composables/useApiError'
import { icons } from '@/lib/icons'
import type { Wallet, WalletTransaction } from '@/types'
import { currencyLabel, formatAmount, parseAmount } from '@/lib/money'

/**
 * Hamyon — the wallet.
 *
 * Mobile-first: one column, a balance card that fills the width, and a ledger
 * that reads as a list of events rather than a table. The desktop layout puts
 * the balance and the actions side by side with the history, because at 1280px
 * a single narrow column of transactions in the middle of an empty screen
 * looks like a rendering fault.
 *
 * Whether the money is real is never inferred here. `wallet.test_mode` comes
 * from the server, and the amount itself carries the word TEST — a badge in the
 * corner can be scrolled past, and the one thing a user must not misread is
 * whether this balance is money.
 */
const auth = useAuthStore()
const toast = useToast()

const wallet = ref<Wallet | null>(null)
const transactions = ref<WalletTransaction[]>([])
const loading = ref(true)
const hasError = ref(false)

const showTopUp = ref(false)
const showWithdraw = ref(false)
const amount = ref('')
const busy = ref(false)
const error = ref('')

/** Amounts a person actually types, so the common case is one tap. */
const QUICK_AMOUNTS = [50000, 100000, 500000]

const testMode = computed(() => wallet.value?.test_mode ?? false)
const label = computed(() => currencyLabel(wallet.value?.currency ?? 'UZS', testMode.value))

const parsedAmount = computed(() => parseAmount(amount.value))

const canWithdraw = computed(
  () => !!wallet.value && wallet.value.available_balance >= wallet.value.min_withdrawal,
)

const topUpValid = computed(() => (parsedAmount.value ?? 0) > 0)

const withdrawValid = computed(
  () =>
    !!wallet.value &&
    (parsedAmount.value ?? 0) >= wallet.value.min_withdrawal &&
    (parsedAmount.value ?? 0) <= wallet.value.available_balance,
)

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

function openTopUp() {
  amount.value = ''
  error.value = ''
  showTopUp.value = true
}

function openWithdraw() {
  amount.value = ''
  error.value = ''
  showWithdraw.value = true
}

/**
 * The idempotency key is minted when the user commits, not per request.
 *
 * That is the whole point: a double tap, a retried request or a refresh mid
 * flight all carry the same key, and the server returns the first movement
 * instead of adding the money twice.
 */
async function topUp() {
  if (!topUpValid.value || busy.value) return

  error.value = ''
  busy.value = true

  const key = paymentKey('top-up')

  try {
    const { data } = await walletApi.testTopUp(parsedAmount.value as number, key)

    wallet.value = data.data
    auth.setWalletSummary({ balance: data.data.balance, balance_minor: data.data.balance_minor })

    if (!transactions.value.some((t) => t.id === data.transaction.id)) {
      transactions.value.unshift(data.transaction)
    }

    toast.success(data.message)
    showTopUp.value = false
  } catch (e) {
    error.value = extractErrorMessage(e)
  } finally {
    busy.value = false
  }
}

async function withdraw() {
  if (!withdrawValid.value || busy.value) return

  error.value = ''
  busy.value = true

  try {
    const { data } = await walletApi.withdraw(parsedAmount.value as number)
    wallet.value = data.data
    showWithdraw.value = false
    await load()
  } catch (e) {
    error.value = extractErrorMessage(e)
  } finally {
    busy.value = false
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
      balance_minor: number
      pending_balance: number
      pending_balance_minor: number
      transaction: WalletTransaction | null
    }) => {
      if (wallet.value) {
        wallet.value.balance = payload.balance
        wallet.value.balance_minor = payload.balance_minor
        wallet.value.pending_balance = payload.pending_balance
        wallet.value.pending_balance_minor = payload.pending_balance_minor
        wallet.value.available_balance = payload.balance
        wallet.value.available_balance_minor = payload.balance_minor
        wallet.value.total_balance = payload.balance + payload.pending_balance
        wallet.value.total_balance_minor = payload.balance_minor + payload.pending_balance_minor
      }

      auth.setWalletSummary({ balance: payload.balance, balance_minor: payload.balance_minor })

      if (payload.transaction && !transactions.value.some((t) => t.id === payload.transaction!.id)) {
        transactions.value.unshift(payload.transaction)
      }
    },

    '.PaymentRefunded': (payload: { amount: number; currency: string }) => {
      toast.success(
        `${formatAmount(payload.amount, payload.currency)} ${label.value} hamyoningizga qaytarildi.`,
      )
    },
  },
})

// Balance changes during a dropped connection are simply missed.
onEchoReconnect(() => void load())

onMounted(load)
</script>

<template>
  <AppLayout>
    <template #header>
      <h1 class="text-lg font-bold text-ink truncate">Hamyon</h1>
    </template>

    <div class="px-4 md:px-8 pt-6 md:pt-8 pb-8 max-w-4xl">
      <div v-if="loading" class="space-y-6">
        <Skeleton variant="block" height="11rem" class="rounded-2xl" />
        <div class="space-y-2">
          <div v-for="i in 3" :key="i" class="card p-4 space-y-2">
            <Skeleton variant="text" width="50%" />
            <Skeleton variant="text" width="30%" />
          </div>
        </div>
      </div>

      <ErrorState v-else-if="hasError" @retry="load" />

      <template v-else-if="wallet">
        <!-- Two columns from `lg` up: the balance and its actions on the left,
             the ledger on the right. Below that it is one stacked column, which
             is the layout the balance card is actually designed for. -->
        <div class="lg:grid lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-6 lg:items-start">
          <div class="space-y-4">
            <TestModeBanner v-if="testMode" />

            <div
              class="rounded-2xl bg-gradient-to-br from-primary-600 to-primary-800 text-white p-6"
              data-testid="wallet-balance"
            >
              <p class="text-primary-100 text-sm flex items-center gap-1.5">
                <FontAwesomeIcon :icon="icons.wallet" class="text-xs" />
                {{ testMode ? 'Test balansi' : 'Mavjud balans' }}
              </p>

              <p class="mt-2 leading-none">
                <span class="text-4xl font-bold tracking-tight">
                  {{ formatAmount(wallet.available_balance, wallet.currency) }}
                </span>
              </p>
              <p class="text-primary-100 text-sm font-medium mt-1.5 tracking-wide">{{ label }}</p>

              <div
                v-if="wallet.pending_balance > 0"
                class="mt-4 pt-3 border-t border-white/20 space-y-1"
              >
                <p class="text-primary-100 text-sm flex items-center justify-between">
                  <span>Yechish jarayonida</span>
                  <span class="font-medium">
                    {{ formatAmount(wallet.pending_balance, wallet.currency) }}
                  </span>
                </p>
                <p class="text-primary-100 text-sm flex items-center justify-between">
                  <span>Jami</span>
                  <span class="font-medium">
                    {{ formatAmount(wallet.total_balance, wallet.currency) }}
                  </span>
                </p>
              </div>

              <div class="mt-5 flex flex-col sm:flex-row lg:flex-col gap-2">
                <button
                  v-if="wallet.can_top_up"
                  class="h-11 px-5 rounded-xl bg-white text-primary-700 text-sm font-semibold transition hover:bg-primary-50 active:scale-[0.98] flex items-center justify-center gap-2 flex-1"
                  data-testid="top-up-button"
                  @click="openTopUp"
                >
                  <FontAwesomeIcon :icon="icons.add" class="text-xs" />
                  Test summa qo'shish
                </button>

                <button
                  class="h-11 px-5 rounded-xl bg-white/15 hover:bg-white/25 transition text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 flex-1"
                  :disabled="!canWithdraw"
                  data-testid="withdraw-button"
                  @click="openWithdraw"
                >
                  Pul yechish
                </button>
              </div>

              <p v-if="!canWithdraw" class="text-primary-100 text-xs mt-2.5">
                Eng kam yechish summasi
                {{ formatAmount(wallet.min_withdrawal, wallet.currency) }} {{ label }}.
              </p>
            </div>
          </div>

          <div class="mt-6 lg:mt-0">
            <h2 class="font-semibold text-ink mb-3">So'nggi operatsiyalar</h2>

            <EmptyState
              v-if="transactions.length === 0"
              :icon="icons.receipt"
              title="Hozircha operatsiyalar yo'q"
              :description="
                wallet.can_top_up
                  ? 'Test balansini to\'ldirib, to\'lov oqimini sinab ko\'ring.'
                  : 'Hamyondagi harakatlar shu yerda ko\'rinadi.'
              "
            />

            <div v-else class="card divide-y divide-border" padding="none">
              <TransactionRow
                v-for="tx in transactions"
                :key="tx.id"
                :transaction="tx"
                :test-mode="testMode"
              />
            </div>

            <p v-if="testMode" class="text-xs text-ink-faint mt-4 leading-relaxed">
              Bu test rejimi. Haqiqiy pul ishlatilmaydi — barcha summalar simulyatsiya.
            </p>
          </div>
        </div>
      </template>
    </div>

    <AppModal
      v-if="showTopUp && wallet"
      title="Test summa qo'shish"
      @close="showTopUp = false"
    >
      <TestModeBanner class="mb-4" />

      <p class="text-sm text-ink-secondary mb-3">
        Joriy balans:
        <span class="font-medium text-ink">
          {{ formatAmount(wallet.balance, wallet.currency) }} {{ label }}
        </span>
      </p>

      <div class="flex gap-2 mb-3">
        <button
          v-for="quick in QUICK_AMOUNTS"
          :key="quick"
          type="button"
          class="flex-1 h-10 rounded-xl border border-border text-sm font-medium text-ink-secondary transition hover:border-primary-300 hover:text-primary-700"
          :class="parsedAmount === quick ? 'border-primary-400 bg-primary-50 text-primary-700' : ''"
          @click="amount = String(quick)"
        >
          {{ formatAmount(quick, wallet.currency) }}
        </button>
      </div>

      <AppInput
        v-model="amount"
        label="Summa"
        inputmode="numeric"
        placeholder="100000"
        data-testid="top-up-amount"
        :hint="`Summa ${label} da kiritiladi`"
      />

      <p v-if="error" class="text-sm text-danger mt-2">{{ error }}</p>

      <AppButton
        class="mt-4"
        :disabled="!topUpValid"
        :loading="busy"
        data-testid="top-up-submit"
        @click="topUp"
      >
        Balansni to'ldirish
      </AppButton>
    </AppModal>

    <AppModal v-if="showWithdraw && wallet" title="Pul yechish" @close="showWithdraw = false">
      <TestModeBanner v-if="testMode" class="mb-4" />

      <p class="text-sm text-ink-secondary mb-3">
        Mavjud: {{ formatAmount(wallet.available_balance, wallet.currency) }} {{ label }} · eng kam
        {{ formatAmount(wallet.min_withdrawal, wallet.currency) }}
      </p>

      <AppInput v-model="amount" label="Summa" inputmode="numeric" placeholder="50000" />

      <p v-if="error" class="text-sm text-danger mt-2">{{ error }}</p>

      <AppButton class="mt-4" :disabled="!withdrawValid" :loading="busy" @click="withdraw">
        Yechish
      </AppButton>
    </AppModal>
  </AppLayout>
</template>
