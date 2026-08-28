import { ref, watch, type Ref } from 'vue'
import client from '@/api/client'
import type { PaymentBreakdown, PaymentType } from '@/types'

interface PricingResponse {
  charges_commission: boolean
  currency: string
  test_mode: boolean
  breakdown: PaymentBreakdown | null
}

/**
 * What Rivex would charge, asked of the server while somebody types a price.
 *
 * The fee is never computed here. A client that multiplied by 5% would be
 * correct right up until an administrator changed the rate, and then the number
 * on the form and the number on the invoice would disagree — with the user
 * believing the form. So the form asks, debounced, and shows nothing rather
 * than a guess while the answer is in flight.
 *
 * Debounced at 350ms: long enough that typing "100000" is one request rather
 * than six, short enough that the figure feels like it belongs to the field.
 */
export function usePricingPreview(
  amount: Ref<number | string>,
  paymentType: Ref<PaymentType>,
  options: { debounceMs?: number } = {},
) {
  const breakdown = ref<PaymentBreakdown | null>(null)
  const chargesCommission = ref(false)
  const testMode = ref(false)
  const loading = ref(false)

  let timer: ReturnType<typeof setTimeout> | undefined
  let sequence = 0

  async function fetchPreview() {
    const value = Number(amount.value)

    if (!Number.isFinite(value) || value <= 0) {
      breakdown.value = null
      chargesCommission.value = false

      return
    }

    const ticket = ++sequence
    loading.value = true

    try {
      const { data } = await client.get<{ data: PricingResponse }>('/pricing/preview', {
        params: { amount: value, payment_type: paymentType.value },
      })

      // A slower earlier request must not overwrite a newer answer.
      if (ticket !== sequence) return

      breakdown.value = data.data.breakdown
      chargesCommission.value = data.data.charges_commission
      testMode.value = data.data.test_mode
    } catch {
      // A failed preview hides the figure rather than showing a stale one:
      // an out-of-date fee is worse than no fee.
      if (ticket === sequence) breakdown.value = null
    } finally {
      if (ticket === sequence) loading.value = false
    }
  }

  watch(
    [amount, paymentType],
    () => {
      clearTimeout(timer)
      timer = setTimeout(fetchPreview, options.debounceMs ?? 350)
    },
    { immediate: true },
  )

  return { breakdown, chargesCommission, testMode, loading }
}
