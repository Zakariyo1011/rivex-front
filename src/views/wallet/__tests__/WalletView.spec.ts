import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { Wallet, WalletTransaction } from '@/types'

const show = vi.fn()
const transactions = vi.fn()
const testTopUp = vi.fn()
const withdraw = vi.fn()

vi.mock('@/api/wallet', () => ({
  walletApi: {
    show: () => show(),
    transactions: () => transactions(),
    testTopUp: (...args: unknown[]) => testTopUp(...args),
    withdraw: (...args: unknown[]) => withdraw(...args),
  },
}))

vi.mock('@/composables/useEcho', () => ({
  disconnectEcho: vi.fn(),
  onEchoReconnect: vi.fn(),
  getEcho: vi.fn(() => null),
}))

vi.mock('@/composables/useEchoChannel', () => ({ useEchoChannel: vi.fn() }))

const success = vi.fn()
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ success, error: vi.fn(), info: vi.fn() }),
}))

const WalletView = (await import('../WalletView.vue')).default

function wallet(overrides: Partial<Wallet> = {}): Wallet {
  return {
    currency: 'UZS',
    balance_minor: 150000,
    balance: 150000,
    balance_formatted: '150 000 UZS',
    pending_balance_minor: 0,
    pending_balance: 0,
    available_balance_minor: 150000,
    available_balance: 150000,
    total_balance_minor: 150000,
    total_balance: 150000,
    min_withdrawal_minor: 1000,
    min_withdrawal: 1000,
    test_mode: true,
    can_top_up: true,
    ...overrides,
  }
}

const TX: WalletTransaction = {
  id: 1,
  direction: 'credit',
  type: 'test_top_up',
  type_label: "Test balans to'ldirildi",
  status: 'completed',
  amount_minor: 100000,
  amount: 100000,
  amount_formatted: '100 000 UZS',
  currency: 'UZS',
  balance_after_minor: 150000,
  balance_after: 150000,
  reference_type: 'test_top_up',
  reference_id: null,
  description: null,
  created_at: '2026-08-26T10:00:00.000000Z',
}

function render() {
  return mount(WalletView, {
    global: {
      stubs: {
        AppLayout: { template: '<div><slot name="header" /><slot /></div>' },
        FontAwesomeIcon: true,
        RouterLink: true,

        // AppModal teleports to <body>, so without this the top-up dialog is
        // rendered outside the wrapper and every assertion about it fails.
        teleport: true,
      },
    },
  })
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  show.mockResolvedValue({ data: { data: wallet() } })
  transactions.mockResolvedValue({ data: { data: [TX] } })
})

describe('WalletView', () => {
  it('shows the balance with the test label', async () => {
    const view = render()
    await flushPromises()

    const text = view.get('[data-testid="wallet-balance"]').text()

    expect(text).toContain('150 000')
    expect(text).toContain('TEST UZS')
    expect(text).toContain('Test balansi')
  })

  /** The one thing a user must not misread. */
  it('always says the money is not real while in test mode', async () => {
    const view = render()
    await flushPromises()

    expect(view.find('[data-testid="test-mode-banner"]').exists()).toBe(true)
    expect(view.text()).toContain('Haqiqiy pul ishlatilmaydi')
  })

  it('drops the test framing when the wallet is real', async () => {
    show.mockResolvedValue({ data: { data: wallet({ test_mode: false, can_top_up: false }) } })

    const view = render()
    await flushPromises()

    expect(view.find('[data-testid="test-mode-banner"]').exists()).toBe(false)
    expect(view.get('[data-testid="wallet-balance"]').text()).toContain('Mavjud balans')
  })

  it('hides the top-up button when the server says it is unavailable', async () => {
    show.mockResolvedValue({ data: { data: wallet({ can_top_up: false }) } })

    const view = render()
    await flushPromises()

    expect(view.find('[data-testid="top-up-button"]').exists()).toBe(false)
  })

  it('lists the ledger', async () => {
    const view = render()
    await flushPromises()

    expect(view.findAll('[data-testid="transaction-row"]')).toHaveLength(1)
    expect(view.text()).toContain("Test balans to'ldirildi")
  })

  it('renders an empty state rather than a blank list', async () => {
    transactions.mockResolvedValue({ data: { data: [] } })

    const view = render()
    await flushPromises()

    expect(view.text()).toContain("Hozircha operatsiyalar yo'q")
  })

  it('surfaces a failed load instead of an empty screen', async () => {
    show.mockRejectedValue(new Error('boom'))

    const view = render()
    await flushPromises()

    expect(view.find('[data-testid="wallet-balance"]').exists()).toBe(false)
    expect(view.text()).toMatch(/xato|qayta/i)
  })

  it('tops up and sends an idempotency key', async () => {
    testTopUp.mockResolvedValue({
      data: {
        message: "Test balansi to'ldirildi.",
        data: wallet({ balance: 250000, balance_minor: 250000, available_balance: 250000 }),
        transaction: { ...TX, id: 2, balance_after: 250000, balance_after_minor: 250000 },
      },
    })

    const view = render()
    await flushPromises()

    await view.get('[data-testid="top-up-button"]').trigger('click')
    await view.get('input[data-testid="top-up-amount"]').setValue('100000')
    await view.get('[data-testid="top-up-submit"]').trigger('click')
    await flushPromises()

    expect(testTopUp).toHaveBeenCalledTimes(1)

    const [amount, key] = testTopUp.mock.calls[0] as [number, string]

    expect(amount).toBe(100000)
    // Without a key a retried request would add the money twice.
    expect(key).toBeTruthy()
    expect(view.get('[data-testid="wallet-balance"]').text()).toContain('250 000')
  })

  it('refuses to submit a top-up with no amount', async () => {
    const view = render()
    await flushPromises()

    await view.get('[data-testid="top-up-button"]').trigger('click')
    await view.get('[data-testid="top-up-submit"]').trigger('click')
    await flushPromises()

    expect(testTopUp).not.toHaveBeenCalled()
  })

  it('shows the server error and keeps the balance untouched', async () => {
    // `isAxiosError` is what extractErrorMessage keys on, so a plain object
    // would fall through to the generic message and the test would pass for
    // the wrong reason.
    testTopUp.mockRejectedValue({
      isAxiosError: true,
      response: { data: { message: "Test rejimi o'chirilgan." } },
    })

    const view = render()
    await flushPromises()

    await view.get('[data-testid="top-up-button"]').trigger('click')
    await view.get('input[data-testid="top-up-amount"]').setValue('100000')
    await view.get('[data-testid="top-up-submit"]').trigger('click')
    await flushPromises()

    expect(view.text()).toContain("Test rejimi o'chirilgan.")
    expect(view.get('[data-testid="wallet-balance"]').text()).toContain('150 000')
  })

  it('disables withdrawal below the minimum', async () => {
    show.mockResolvedValue({
      data: {
        data: wallet({
          balance: 500,
          balance_minor: 500,
          available_balance: 500,
          available_balance_minor: 500,
        }),
      },
    })

    const view = render()
    await flushPromises()

    expect(
      (view.get('[data-testid="withdraw-button"]').element as HTMLButtonElement).disabled,
    ).toBe(true)
  })
})
