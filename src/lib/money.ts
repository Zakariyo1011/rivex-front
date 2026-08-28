/**
 * Money on the client.
 *
 * ---------------------------------------------------------------------------
 * THE RULE
 * ---------------------------------------------------------------------------
 *
 * The client FORMATS money. It does not compute it.
 *
 * Every figure Rivex shows — a price, a fee, a balance, a settlement — is
 * calculated on the server and sent in two forms: `*_minor` (the exact integer
 * the ledger holds) and a major-unit number for display. Nothing here
 * multiplies a percentage or divides by a subunit count, because the moment it
 * does, the number on screen and the number billed can differ — and the user
 * will believe the one on screen.
 *
 * The one thing this file DOES know is how many decimal places a currency has,
 * and only so `100000` renders as "100 000 UZS" rather than "100000". That
 * table mirrors App\Support\Currency; if a currency is added there and not
 * here, it degrades to two decimals rather than rendering wrongly.
 */

/** ISO 4217 code -> decimal places. Mirrors App\Support\Currency. */
const EXPONENTS: Record<string, number> = {
  UZS: 0,
  JPY: 0,
  KRW: 0,
  USD: 2,
  EUR: 2,
  GBP: 2,
  RUB: 2,
  KZT: 2,
  TRY: 2,
  AED: 2,
}

export function currencyExponent(currency: string): number {
  return EXPONENTS[currency?.toUpperCase()] ?? 2
}

/** Thin-space grouping: "100 000". The convention used across the product. */
export function groupDigits(value: string): string {
  const [whole = '', fraction] = value.split('.')

  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

  return fraction ? `${grouped}.${fraction}` : grouped
}

/**
 * A major-unit amount rendered for its currency, without the code.
 *
 * "100 000" for UZS, "12.50" for USD.
 */
export function formatAmount(amount: number, currency = 'UZS'): string {
  const exponent = currencyExponent(currency)

  return groupDigits(Math.abs(amount).toFixed(exponent))
}

/** "100 000 UZS". */
export function formatCurrency(amount: number, currency = 'UZS'): string {
  return `${formatAmount(amount, currency)} ${currency}`
}

/**
 * "100 000 TEST UZS" while the wallet is simulated.
 *
 * The word TEST is inside the amount rather than beside it on purpose: a badge
 * elsewhere on the screen can be scrolled past or missed in a screenshot, and
 * the one thing a user must never misread is whether this money is real.
 */
export function formatTestAware(amount: number, currency = 'UZS', testMode = false): string {
  return `${formatAmount(amount, currency)} ${testMode ? 'TEST ' : ''}${currency}`
}

/** The currency label alone: "TEST UZS" or "UZS". */
export function currencyLabel(currency = 'UZS', testMode = false): string {
  return `${testMode ? 'TEST ' : ''}${currency}`
}

/**
 * A signed amount for a ledger row: "+100 000", "−5 000".
 *
 * The minus is U+2212, not a hyphen — at small sizes a hyphen next to a digit
 * reads as part of the number.
 */
export function formatSigned(amount: number, direction: 'credit' | 'debit', currency = 'UZS'): string {
  return `${direction === 'credit' ? '+' : '−'}${formatAmount(amount, currency)}`
}

/**
 * Parse what a person typed into a major-unit number, or null.
 *
 * Accepts the spaces the formatter puts in, so a value can be pasted back.
 * Returns null rather than NaN or 0, because "not a number" and "zero" must
 * reach the caller as different answers.
 */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[\s ]/g, '').replace(',', '.')

  if (cleaned === '' || !/^\d*\.?\d*$/.test(cleaned)) return null

  const value = Number(cleaned)

  return Number.isFinite(value) ? value : null
}
