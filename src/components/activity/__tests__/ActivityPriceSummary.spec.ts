import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import ActivityPriceSummary from '@/components/activity/ActivityPriceSummary.vue'
import type { PaymentBreakdown } from '@/types'

const FaStub = defineComponent({ setup: () => () => h('i') })

/**
 * The create screen's price panel.
 *
 * What these pin down is an absence as much as a presence. The screen used to
 * render the full `PaymentSummary`, whose settlement line — "Tomonlar
 * o'rtasida · Rivex orqali o'tmaydi · 47 500" sitting under a price of
 * 50 000 — reads as though the commission had been deducted from the price.
 * It has not, and that misreading is the reason this component exists.
 */
function breakdown(overrides: Partial<PaymentBreakdown> = {}): PaymentBreakdown {
  return {
    currency: 'UZS',
    activity_amount_minor: 50000,
    commission_rate: 5,
    commission_minor: 2500,
    platform_collected_minor: 2500,
    external_settled_minor: 50000,
    settlement_minor: 47500,
    activity_amount: 50000,
    commission: 2500,
    platform_collected: 2500,
    external_settled: 50000,
    settlement: 47500,
    ...overrides,
  } as PaymentBreakdown
}

function render(props: { breakdown: PaymentBreakdown; testMode?: boolean }) {
  return mount(ActivityPriceSummary, {
    props,
    global: { components: { FontAwesomeIcon: FaStub } },
  })
}

describe('ActivityPriceSummary', () => {
  it('shows the price exactly as entered, never net of commission', () => {
    const text = render({ breakdown: breakdown() }).text()

    expect(text).toContain('50 000')
    // The single most important assertion in this file: the settlement figure
    // must not appear anywhere on a screen where nobody is paying.
    expect(text).not.toContain('47 500')
  })

  it('states the commission as a rate and an amount, alongside the price', () => {
    const text = render({ breakdown: breakdown() }).text()

    expect(text).toContain('Rivex komissiyasi')
    expect(text).toContain('5%')
    expect(text).toContain('2 500')
  })

  it('omits the wording that made the old panel confusing', () => {
    const text = render({ breakdown: breakdown() }).text()

    expect(text).not.toContain("Tomonlar o'rtasida")
    expect(text).not.toContain("Rivex orqali o'tmaydi")
    expect(text).not.toContain('Rivex oladi')
  })

  it('marks simulated money as TEST, inside the amount rather than beside it', () => {
    expect(render({ breakdown: breakdown(), testMode: true }).text()).toContain('50 000 TEST UZS')
  })

  it('drops the TEST marker when the money is real', () => {
    const text = render({ breakdown: breakdown(), testMode: false }).text()

    expect(text).toContain('50 000 UZS')
    expect(text).not.toContain('TEST')
  })

  /** The rate is the server's; the component must not assume it is five. */
  it('renders whatever rate the server sent', () => {
    const text = render({
      breakdown: breakdown({ commission_rate: 12.5, commission: 6250, commission_minor: 6250 }),
    }).text()

    expect(text).toContain('12.5%')
    expect(text).toContain('6 250')
  })
})
