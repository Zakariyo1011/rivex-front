<script setup lang="ts">
import { computed } from 'vue'
import TestModeBanner from '@/components/wallet/TestModeBanner.vue'
import { formatAmount } from '@/lib/money'
import type { PaymentBreakdown } from '@/types'

/**
 * The price of an activity, while it is being set.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS NOT PaymentSummary
 * ---------------------------------------------------------------------------
 *
 * `PaymentSummary` shows four figures — price, fee, "settled between the two of
 * you", and the total leaving the wallet — plus a paragraph explaining that
 * Rivex does not custody the activity amount. Every one of those is correct and
 * necessary ON A PAYMENT SCREEN, where somebody is about to be charged and has
 * to know exactly what the button takes.
 *
 * It is the wrong thing on the CREATE screen, where nobody is paying anything
 * yet. The organiser is answering one question — "how much does this cost?" —
 * and four financial lines about custody and settlement answer a question they
 * have not asked. Worse, "Tomonlar o'rtasida: 47 500" sitting under a price of
 * 50 000 reads as though the fee has been taken off the price. It has not, and
 * that misreading is the specific confusion this component exists to remove.
 *
 * So: two lines. What it costs, and what Rivex charges on top of it.
 *
 * ---------------------------------------------------------------------------
 * THE FIGURES ARE THE SERVER'S
 * ---------------------------------------------------------------------------
 *
 * Nothing here multiplies a percentage. The rate is an administrator-editable
 * setting, so a client that computed 5% itself would be right until somebody
 * changed it, and then the form and the invoice would disagree — with the user
 * believing the form. Every number comes from `PaymentBreakdown`.
 */
const props = withDefaults(
  defineProps<{
    breakdown: PaymentBreakdown
    testMode?: boolean
  }>(),
  { testMode: false },
)

const currencyCode = computed(() => `${props.testMode ? 'TEST ' : ''}${props.breakdown.currency}`)

const money = (value: number) =>
  `${formatAmount(value, props.breakdown.currency)} ${currencyCode.value}`
</script>

<template>
  <div class="rounded-2xl border border-border overflow-hidden" data-testid="activity-price-summary">
    <dl class="divide-y divide-border text-sm">
      <!-- The price, stated as the price. It is exactly what was typed: the
           commission is charged ON this amount, never taken OUT of it. -->
      <div class="flex items-center justify-between gap-3 px-4 py-3">
        <dt class="text-ink-secondary">Summa</dt>
        <dd class="font-semibold text-ink shrink-0 tabular-nums" data-testid="activity-price">
          {{ money(breakdown.activity_amount) }}
        </dd>
      </div>

      <div class="flex items-center justify-between gap-3 px-4 py-3">
        <dt class="text-ink-secondary">Rivex komissiyasi</dt>
        <dd class="shrink-0 text-right">
          <span class="font-semibold text-ink tabular-nums">{{ breakdown.commission_rate }}%</span>
          <span class="block text-xs text-ink-faint tabular-nums mt-0.5">
            {{ money(breakdown.commission) }}
          </span>
        </dd>
      </div>
    </dl>

    <div v-if="testMode" class="px-4 py-3 border-t border-border">
      <TestModeBanner variant="inline" />
    </div>
  </div>
</template>
