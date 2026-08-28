import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TransactionRow from '../TransactionRow.vue'
import type { WalletTransaction } from '@/types'

function tx(overrides: Partial<WalletTransaction> = {}): WalletTransaction {
  return {
    id: 1,
    direction: 'credit',
    type: 'test_top_up',
    type_label: "Test balans to'ldirildi",
    status: 'completed',
    amount_minor: 100000,
    amount: 100000,
    amount_formatted: '100 000 UZS',
    currency: 'UZS',
    balance_after_minor: 100000,
    balance_after: 100000,
    reference_type: 'test_top_up',
    reference_id: null,
    description: null,
    created_at: '2026-08-26T10:00:00.000000Z',
    ...overrides,
  }
}

function render(transaction: WalletTransaction, testMode = true) {
  return mount(TransactionRow, {
    props: { transaction, testMode },
    global: { stubs: { FontAwesomeIcon: true } },
  })
}

describe('TransactionRow', () => {
  it('signs a credit and a debit differently', () => {
    expect(render(tx()).text()).toContain('+100 000')

    expect(
      render(tx({ direction: 'debit', type: 'commission', amount: 5000, amount_minor: 5000 })).text(),
    ).toContain('−5 000')
  })

  /**
   * The label comes from the server enum, not from the description string.
   *
   * It used to be pattern-matched out of the free text, so a copy change broke
   * the row and any type the client did not recognise rendered as "Kirim".
   */
  it('falls back to the server-supplied label when there is no description', () => {
    expect(render(tx()).text()).toContain("Test balans to'ldirildi")
  })

  it('prefers an explicit description over the generic label', () => {
    expect(render(tx({ description: 'Rivex komissiyasi: RVX-1' })).text()).toContain(
      'Rivex komissiyasi: RVX-1',
    )
  })

  it('marks the currency as test money when the wallet is simulated', () => {
    expect(render(tx(), true).text()).toContain('TEST UZS')
    expect(render(tx(), false).text()).not.toContain('TEST UZS')
  })
})
