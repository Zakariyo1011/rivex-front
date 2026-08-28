<script setup lang="ts">
import { computed } from 'vue'
import { icons } from '@/lib/icons'
import { formatDate, formatTime } from '@/lib/datetime'
import { formatAmount, formatSigned } from '@/lib/money'
import type { WalletTransaction } from '@/types'

/**
 * One line of the ledger.
 *
 * The label and the icon come from `type`, which is a server-side enum — they
 * used to be pattern-matched out of the free-text description, so a copy change
 * silently broke the icons and any row the client did not recognise fell back
 * to "Kirim"/"Chiqim", which told the user nothing about what happened.
 */
const props = defineProps<{ transaction: WalletTransaction; testMode?: boolean }>()

const isCredit = computed(() => props.transaction.direction === 'credit')

const icon = computed(() => {
  switch (props.transaction.type) {
    case 'test_top_up':
      return icons.topUp
    case 'commission':
      return icons.amount
    case 'refund':
    case 'withdrawal_reversal':
      return icons.refund
    case 'withdrawal':
      return icons.payment
    case 'settlement':
      return icons.receipt
    case 'adjustment':
      return icons.adjust
    default:
      return isCredit.value ? icons.incoming : icons.outgoing
  }
})
</script>

<template>
  <div class="flex items-center gap-3 px-4 py-3.5" data-testid="transaction-row">
    <span
      class="w-9 h-9 rounded-full flex items-center justify-center text-sm shrink-0"
      :class="isCredit ? 'bg-success-bg text-success' : 'bg-surface-muted text-ink-muted'"
    >
      <FontAwesomeIcon :icon="icon" />
    </span>

    <div class="min-w-0 flex-1">
      <p class="text-sm font-medium text-ink truncate">
        {{ transaction.description || transaction.type_label }}
      </p>
      <p class="text-xs text-ink-faint">
        {{ formatDate(transaction.created_at) }}, {{ formatTime(transaction.created_at) }}
        <span class="hidden sm:inline">
          · Balans: {{ formatAmount(transaction.balance_after, transaction.currency) }}
        </span>
      </p>
    </div>

    <div class="text-right shrink-0">
      <p class="font-semibold text-sm" :class="isCredit ? 'text-success' : 'text-ink'">
        {{ formatSigned(transaction.amount, transaction.direction, transaction.currency) }}
      </p>
      <p class="text-[0.65rem] text-ink-faint uppercase tracking-wide">
        {{ testMode ? 'TEST ' : '' }}{{ transaction.currency }}
      </p>
    </div>
  </div>
</template>
