import client from './client'
import type { Wallet, WalletTransaction, PaginatedResponse } from '@/types'

export const walletApi = {
  show() {
    return client.get<{ data: Wallet }>('/wallet')
  },
  transactions() {
    return client.get<PaginatedResponse<WalletTransaction>>('/wallet/transactions')
  },
  withdraw(amount: number) {
    return client.post<{ data: Wallet }>('/wallet/withdraw', { amount })
  },
}
