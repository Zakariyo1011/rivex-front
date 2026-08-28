import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PaymentSummary from '../PaymentSummary.vue'
import type { PaymentBreakdown } from '@/types'

const BREAKDOWN: PaymentBreakdown = {
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

function render(props: Partial<InstanceType<typeof PaymentSummary>['$props']> = {}) {
  return mount(PaymentSummary, {
    props: { breakdown: BREAKDOWN, ...props },
    global: { stubs: { FontAwesomeIcon: true } },
  })
}

describe('PaymentSummary', () => {
  it('shows the three figures the user has to be able to tell apart', () => {
    const text = render().text()

    expect(text).toContain('100 000') // the activity price
    expect(text).toContain('5 000') // Rivex's fee
    expect(text).toContain('95 000') // settled between the two people
  })

  /**
   * The confusion this component exists to prevent: a "To'lash" button under a
   * 100 000 price does NOT take 100 000. The total has to be the fee.
   */
  it('states that only the platform fee is charged', () => {
    const total = render().get('[data-testid="payment-total"]').text()

    expect(total).toContain('5 000')
    expect(total).not.toContain('100 000')
  })

  it('marks simulated money in the amounts themselves', () => {
    const text = render({ testMode: true }).text()

    expect(text).toContain('TEST UZS')
    expect(text).toContain('Test rejimi')
  })

  it('says nothing about test money when the wallet is real', () => {
    const text = render({ testMode: false }).text()

    expect(text).not.toContain('TEST UZS')
  })

  /** Nothing is computed here — the figures come from the server verbatim. */
  it('renders a different rate without recalculating anything', () => {
    const text = render({
      breakdown: {
        ...BREAKDOWN,
        commission_rate: 12,
        commission_minor: 12000,
        commission: 12000,
        platform_collected_minor: 12000,
        platform_collected: 12000,
        settlement_minor: 88000,
        settlement: 88000,
      },
    }).text()

    expect(text).toContain('12%')
    expect(text).toContain('12 000')
    expect(text).toContain('88 000')
  })

  it('hides the total when only previewing a price', () => {
    expect(render({ showTotal: false }).find('[data-testid="payment-total"]').exists()).toBe(false)
  })
})
