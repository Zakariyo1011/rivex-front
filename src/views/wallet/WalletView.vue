<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AppLayout from '@/layouts/AppLayout.vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import { walletApi } from '@/api/wallet'
import { extractErrorMessage } from '@/composables/useApiError'
import type { Wallet, WalletTransaction } from '@/types'

const wallet = ref<Wallet | null>(null)
const transactions = ref<WalletTransaction[]>([])
const loading = ref(true)
const showWithdraw = ref(false)
const amount = ref('')
const withdrawing = ref(false)
const error = ref('')

async function load() {
  const [walletRes, txRes] = await Promise.all([walletApi.show(), walletApi.transactions()])
  wallet.value = walletRes.data.data
  transactions.value = txRes.data.data
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

onMounted(async () => {
  await load()
  loading.value = false
})
</script>

<template>
  <AppLayout>
    <div class="px-4 md:px-8 pt-6 md:pt-8 max-w-xl pb-8">
      <h1 class="text-xl font-bold text-ink mb-5">Hamyon</h1>

      <div v-if="loading" class="text-ink-faint text-sm py-12 text-center">Yuklanmoqda...</div>

      <template v-else-if="wallet">
        <div class="rounded-2xl bg-gradient-to-br from-primary-600 to-primary-800 text-white p-6">
          <p class="text-primary-100 text-sm">Balans</p>
          <p class="text-3xl font-bold mt-1">{{ wallet.balance.toLocaleString() }} {{ wallet.currency }}</p>
          <p v-if="wallet.pending_balance > 0" class="text-primary-100 text-sm mt-1">
            Kutilayotgan: {{ wallet.pending_balance.toLocaleString() }} {{ wallet.currency }}
          </p>
          <button
            class="mt-4 h-10 px-5 rounded-xl bg-white/15 hover:bg-white/25 transition text-sm font-semibold"
            @click="showWithdraw = true"
          >
            Pul yechish
          </button>
        </div>

        <h2 class="font-semibold text-ink mt-6 mb-3">Tranzaksiyalar</h2>
        <div v-if="transactions.length === 0" class="text-sm text-ink-faint py-8 text-center">
          Hozircha tranzaksiyalar yo'q.
        </div>
        <div v-else class="space-y-2">
          <div v-for="tx in transactions" :key="tx.id" class="card p-4 flex items-center justify-between">
            <div class="min-w-0">
              <p class="text-sm font-medium text-ink truncate">{{ tx.description ?? (tx.type === 'credit' ? 'Kirim' : 'Chiqim') }}</p>
              <p class="text-xs text-ink-faint">{{ new Date(tx.created_at).toLocaleDateString('uz-UZ') }}</p>
            </div>
            <span class="font-semibold shrink-0" :class="tx.type === 'credit' ? 'text-success' : 'text-danger'">
              {{ tx.type === 'credit' ? '+' : '-' }}{{ tx.amount.toLocaleString() }}
            </span>
          </div>
        </div>
      </template>
    </div>

    <AppModal v-if="showWithdraw" title="Pul yechish" @close="showWithdraw = false">
      <AppInput v-model="amount" label="Summa (UZS)" type="number" placeholder="50000" />
      <p v-if="error" class="text-sm text-danger mt-2">{{ error }}</p>
      <AppButton class="mt-4" :loading="withdrawing" @click="withdraw">Yechish</AppButton>
    </AppModal>
  </AppLayout>
</template>
