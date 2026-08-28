import client from './client'
import type { PaginatedResponse, Wallet, WalletTransaction, WalletTransactionType } from '@/types'

export const walletApi = {
  show() {
    return client.get<{ data: Wallet }>('/wallet')
  },

  transactions(params: { type?: WalletTransactionType; page?: number } = {}) {
    return client.get<PaginatedResponse<WalletTransaction>>('/wallet/transactions', { params })
  },

  /**
   * Add virtual money. Development only — the server refuses it wherever mock
   * payments are off, which is why the button is gated on `wallet.can_top_up`
   * rather than on a build flag.
   *
   * The amount is sent in MAJOR units, as typed. The currency is never sent:
   * it is the wallet's, and the server decides it.
   *
   * `idempotencyKey` makes a double tap or a retried request add the money
   * once. The caller generates one per user action, not per request.
   */
  testTopUp(amount: number, idempotencyKey: string) {
    return client.post<{ message: string; data: Wallet; transaction: WalletTransaction }>(
      '/wallet/test-top-up',
      { amount },
      { headers: { 'Idempotency-Key': idempotencyKey } },
    )
  },

  withdraw(amount: number) {
    return client.post<{ data: Wallet }>('/wallet/withdraw', { amount })
  },
}
