<script setup lang="ts">
import { computed } from 'vue'
import TestModeBanner from '@/components/wallet/TestModeBanner.vue'
import { formatAmount } from '@/lib/money'
import { icons } from '@/lib/icons'
import type { PaymentBreakdown } from '@/types'

/**
 * What is being charged, and what is not.
 *
 * The confusion this component exists to prevent: seeing "100 000" on an
 * activity and a "To'lash" button, and assuming the button takes 100 000.
 * It does not. Rivex collects only its fee; the activity amount is settled
 * between the two people themselves. So the summary shows three lines and says
 * plainly which one leaves the wallet.
 *
 * Every figure comes from the server's `PaymentBreakdown`. Nothing here
 * multiplies a percentage — if it did, the number shown and the number billed
 * could differ, and the user would believe the one on screen.
 */
const props = withDefaults(
  defineProps<{
    breakdown: PaymentBreakdown
    testMode?: boolean
    /** True on a payment screen, false when only previewing a price. */
    showTotal?: boolean
    /** Whether the viewer is the one who will be billed. */
    payable?: boolean
  }>(),
  { testMode: false, showTotal: true, payable: true },
)

const currency = computed(() => props.breakdown.currency)
const label = computed(() => `${props.testMode ? 'TEST ' : ''}${currency.value}`)

const money = (value: number) => `${formatAmount(value, currency.value)} ${label.value}`
</script>

<template>
  <div class="rounded-2xl border border-border overflow-hidden" data-testid="payment-summary">
    <dl class="divide-y divide-border text-sm">
      <div class="flex items-center justify-between gap-3 px-4 py-3">
        <dt class="text-ink-secondary">Faoliyat narxi</dt>
        <dd class="font-medium text-ink shrink-0">{{ money(breakdown.activity_amount) }}</dd>
      </div>

      <div class="flex items-center justify-between gap-3 px-4 py-3">
        <dt class="text-ink-secondary">
          Rivex komissiyasi
          <span class="text-ink-faint">({{ breakdown.commission_rate }}%)</span>
        </dt>
        <dd class="font-medium text-ink shrink-0">{{ money(breakdown.commission) }}</dd>
      </div>

      <div class="flex items-center justify-between gap-3 px-4 py-3">
        <dt class="text-ink-secondary">
          Tomonlar o'rtasida
          <span class="block text-xs text-ink-faint mt-0.5">Rivex orqali o'tmaydi</span>
        </dt>
        <dd class="font-medium text-ink-muted shrink-0">{{ money(breakdown.settlement) }}</dd>
      </div>

      <!-- The one line that matters: what actually leaves the wallet. -->
      <div
        v-if="showTotal"
        class="flex items-center justify-between gap-3 px-4 py-3.5 bg-primary-50"
      >
        <dt class="font-semibold text-primary-700">
          {{ payable ? "Jami to'lanadi" : 'Rivex oladi' }}
        </dt>
        <dd class="font-bold text-primary-700 shrink-0" data-testid="payment-total">
          {{ money(breakdown.platform_collected) }}
        </dd>
      </div>
    </dl>

    <div class="px-4 py-3 border-t border-border space-y-2">
      <p class="text-xs text-ink-faint leading-relaxed flex items-start gap-1.5">
        <FontAwesomeIcon :icon="icons.info" class="mt-0.5 shrink-0" />
        Rivex faqat platforma komissiyasini oladi. Faoliyat summasini siz va sherigingiz
        o'zaro hal qilasiz.
      </p>
      <TestModeBanner v-if="testMode" variant="inline" />
    </div>
  </div>
</template>
