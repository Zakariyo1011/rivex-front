import client from './client'
import type { Invoice, Payment, PaymentMethod } from '@/types'

export const invoicesApi = {
  mine(activityId?: number) {
    return client.get<{ data: Invoice[] }>('/invoices', {
      params: activityId ? { activity_id: activityId } : {},
    })
  },

  show(id: number) {
    return client.get<{ data: Invoice }>(`/invoices/${id}`)
  },

  /**
   * `provider` hands off to the configured gateway (may return a checkout_url
   * to redirect to). `wallet` settles instantly from the Rivex balance.
   *
   * `idempotencyKey` is what makes a double-clicked "To'lash" button pay once:
   * the server returns the FIRST payment for a repeated key instead of making
   * a second. Generate one per user action — see `paymentKey()`.
   */
  pay(id: number, method: PaymentMethod = 'provider', idempotencyKey: string) {
    return client.post<{ data: Payment }>(
      `/invoices/${id}/pay`,
      { method },
      { headers: { 'Idempotency-Key': idempotencyKey } },
    )
  },
}

export const paymentsApi = {
  show(id: number) {
    return client.get<{ data: Payment }>(`/payments/${id}`)
  },

  /** Capture a payment the gateway left authorized. Safe to repeat. */
  complete(id: number) {
    return client.post<{ data: Payment }>(`/payments/${id}/complete`)
  },

  refund(id: number, reason?: string) {
    return client.post<{ data: Payment }>(`/payments/${id}/refund`, { reason })
  },
}

/**
 * A key for one user action, stable across retries of that action.
 *
 * Deliberately generated when the user commits — not per HTTP request — so a
 * network-layer retry, a refresh, or a second click on a button that has not
 * answered yet all carry the same key and produce one payment.
 */
export function paymentKey(scope: string): string {
  return `${scope}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
