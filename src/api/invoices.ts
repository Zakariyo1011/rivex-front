import client from './client'
import type { Invoice, Payment, PaymentMethod } from '@/types'

export const invoicesApi = {
  mine(activityId?: number) {
    return client.get<{ data: Invoice[] }>('/invoices', { params: activityId ? { activity_id: activityId } : {} })
  },
  show(id: number) {
    return client.get<{ data: Invoice }>(`/invoices/${id}`)
  },
  /**
   * `provider` hands off to the configured gateway (may return a checkout_url
   * to redirect to). `wallet` settles instantly from the Rivex balance.
   */
  pay(id: number, method: PaymentMethod = 'provider') {
    return client.post<{ data: Payment }>(`/invoices/${id}/pay`, { method })
  },
}
