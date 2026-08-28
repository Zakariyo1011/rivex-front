import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import type { PaymentType } from '@/types'

const get = vi.fn()
vi.mock('@/api/client', () => ({ default: { get: (...args: unknown[]) => get(...args) } }))

const { usePricingPreview } = await import('../usePricingPreview')

const BREAKDOWN = {
  currency: 'UZS',
  activity_amount_minor: 100000,
  activity_amount: 100000,
  commission_rate: 5,
  commission_minor: 5000,
  commission: 5000,
  platform_collected_minor: 5000,
  platform_collected: 5000,
  external_settled_minor: 100000,
  external_settled: 100000,
  settlement_minor: 95000,
  settlement: 95000,
}

function ok(breakdown: unknown = BREAKDOWN, chargesCommission = true) {
  return {
    data: { data: { breakdown, charges_commission: chargesCommission, currency: 'UZS', test_mode: true } },
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
})

afterEach(() => {
  vi.useRealTimers()
})

/** Lets the debounce fire and the promise it starts settle. */
async function settle() {
  await vi.runAllTimersAsync()
  await nextTick()
}

describe('usePricingPreview', () => {
  it('asks the server for the fee instead of computing one', async () => {
    get.mockResolvedValue(ok())

    const amount = ref<number | string>(100000)
    const type = ref<PaymentType>('participant_pays')
    const pricing = usePricingPreview(amount, type)

    await settle()

    expect(get).toHaveBeenCalledWith('/pricing/preview', {
      params: { amount: 100000, payment_type: 'participant_pays' },
    })
    expect(pricing.breakdown.value?.commission_minor).toBe(5000)
    expect(pricing.testMode.value).toBe(true)
  })

  it('does not ask about an amount that is not one yet', async () => {
    const pricing = usePricingPreview(ref(0), ref<PaymentType>('participant_pays'))

    await settle()

    expect(get).not.toHaveBeenCalled()
    expect(pricing.breakdown.value).toBeNull()
  })

  /** One request per pause in typing, not one per keystroke. */
  it('debounces while the price is being typed', async () => {
    get.mockResolvedValue(ok())

    const amount = ref<number | string>(1)
    usePricingPreview(amount, ref<PaymentType>('participant_pays'))

    amount.value = 10
    amount.value = 100
    amount.value = 1000
    amount.value = 100000

    await settle()

    expect(get).toHaveBeenCalledTimes(1)
    expect(get.mock.calls[0]?.[1]).toMatchObject({ params: { amount: 100000 } })
  })

  it('reports that a shared-cost activity is not billed at all', async () => {
    get.mockResolvedValue(ok(null, false))

    const pricing = usePricingPreview(ref(100000), ref<PaymentType>('shared_cost'))

    await settle()

    // Null, not a zeroed breakdown: "not billed" and "billed nothing" are
    // different statements and the form renders them differently.
    expect(pricing.breakdown.value).toBeNull()
    expect(pricing.chargesCommission.value).toBe(false)
  })

  /** A stale fee is worse than no fee, so a failure hides the figure. */
  it('shows nothing rather than a stale figure when the request fails', async () => {
    get.mockResolvedValueOnce(ok())

    const amount = ref<number | string>(100000)
    const pricing = usePricingPreview(amount, ref<PaymentType>('participant_pays'))

    await settle()
    expect(pricing.breakdown.value).not.toBeNull()

    get.mockRejectedValueOnce(new Error('offline'))
    amount.value = 200000

    await settle()

    expect(pricing.breakdown.value).toBeNull()
  })
})
