import { describe, it, expect } from 'vitest'
import {
  formatDayLong,
  formatDuration,
  formatTimeRange,
  fromApiTimestamp,
  toApiTimestamp,
} from '@/lib/datetime'

/**
 * The timezone contract, and the formatting that used to break it.
 *
 * 🔴 THE BUG THESE EXIST FOR
 *
 * The create form sent `` `${date} ${time}:00` `` — a wall-clock reading with
 * nothing in it to say which clock. The API's timezone is UTC, so 18:00 in
 * Tashkent was stored as 18:00Z and rendered back as 23:00. Somebody arranging
 * a meet-up for six in the evening published one for eleven at night.
 *
 * These tests are written so they hold in ANY timezone the suite runs in: they
 * assert the round trip and the local reading, never a hardcoded offset.
 */
describe('toApiTimestamp', () => {
  it('turns a local date and time into the instant it names', () => {
    const iso = toApiTimestamp('2027-01-01', '18:00')!

    expect(iso).toBe(new Date('2027-01-01T18:00').toISOString())
    expect(iso.endsWith('Z')).toBe(true)
  })

  it('round-trips back to the same local wall clock', () => {
    const iso = toApiTimestamp('2027-06-15', '09:05')!
    const back = fromApiTimestamp(iso)

    expect(back.date).toBe('2027-06-15')
    expect(back.time).toBe('09:05')
  })

  it('returns null rather than guessing at an incomplete pair', () => {
    expect(toApiTimestamp('', '18:00')).toBeNull()
    expect(toApiTimestamp('2027-01-01', '')).toBeNull()
    expect(toApiTimestamp('not-a-date', '18:00')).toBeNull()
  })

  /**
   * The specific failure: a space-separated string is not an instant.
   * `new Date('2027-01-01 18:00:00')` is parsed as LOCAL by browsers, but the
   * server read the same characters as UTC — which is where the five hours went.
   */
  it('never emits a bare wall-clock string', () => {
    expect(toApiTimestamp('2027-01-01', '18:00')).not.toBe('2027-01-01 18:00:00')
  })
})

describe('formatTimeRange', () => {
  it('renders a same-day range as "18:00 — 20:00"', () => {
    const from = new Date('2027-01-01T18:00')
    const to = new Date('2027-01-01T20:00')

    expect(formatTimeRange(from, to)).toBe('18:00 — 20:00')
  })

  /** "23:00 — 01:00" alone reads as a backwards 22-hour event. */
  it('names the day when the range crosses midnight', () => {
    const from = new Date('2027-01-01T23:00')
    const to = new Date('2027-01-02T01:00')

    expect(formatTimeRange(from, to)).toContain('2-yanvar')
  })
})

describe('formatDuration', () => {
  it('speaks a length the way a length is spoken', () => {
    expect(formatDuration(45)).toBe('45 daq')
    expect(formatDuration(60)).toBe('1 soat')
    expect(formatDuration(150)).toBe('2 soat 30 daq')
  })

  it('says nothing rather than "0 daq" for a non-length', () => {
    expect(formatDuration(0)).toBe('')
    expect(formatDuration(Number.NaN)).toBe('')
  })
})

describe('formatDayLong', () => {
  /**
   * 🔴 The wizard used `toLocaleDateString('uz-UZ', { weekday, day, month })`
   * and previewed **"M08 28, Fri"** — Chrome's CLDR data for `uz` has no real
   * month names. This is the whole reason the module hand-rolls them.
   */
  it('uses real Uzbek month and weekday names', () => {
    const label = formatDayLong(new Date('2026-08-28T12:00'))

    expect(label).toBe('28-avgust, juma')
    expect(label).not.toMatch(/M\d{2}/)
    expect(label).not.toContain('Fri')
  })
})
