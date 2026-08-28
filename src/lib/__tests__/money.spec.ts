import { describe, it, expect } from 'vitest'
import {
  currencyExponent,
  formatAmount,
  formatCurrency,
  formatSigned,
  formatTestAware,
  parseAmount,
} from '../money'

describe('money formatting', () => {
  it('knows UZS has no subunit', () => {
    expect(currencyExponent('UZS')).toBe(0)
    expect(currencyExponent('usd')).toBe(2)
    // An unknown currency degrades to two places rather than rendering wrongly.
    expect(currencyExponent('XYZ')).toBe(2)
  })

  it('groups thousands the way the rest of the product does', () => {
    expect(formatAmount(100000, 'UZS')).toBe('100 000')
    expect(formatAmount(1500000, 'UZS')).toBe('1 500 000')
    expect(formatAmount(999, 'UZS')).toBe('999')
    expect(formatAmount(12.5, 'USD')).toBe('12.50')
  })

  it('never renders a UZS amount with decimals', () => {
    expect(formatCurrency(100000, 'UZS')).toBe('100 000 UZS')
  })

  /** The whole reason the test label lives inside the amount. */
  it('marks simulated money in the amount itself', () => {
    expect(formatTestAware(150000, 'UZS', true)).toBe('150 000 TEST UZS')
    expect(formatTestAware(150000, 'UZS', false)).toBe('150 000 UZS')
  })

  it('signs ledger rows with a real minus sign', () => {
    expect(formatSigned(100000, 'credit', 'UZS')).toBe('+100 000')
    expect(formatSigned(5000, 'debit', 'UZS')).toBe('−5 000')
  })

  it('parses back what it printed', () => {
    expect(parseAmount('100 000')).toBe(100000)
    expect(parseAmount('12,50')).toBe(12.5)
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('abc')).toBeNull()
    // Zero is a number, not an absence — the caller decides what to do with it.
    expect(parseAmount('0')).toBe(0)
  })
})
