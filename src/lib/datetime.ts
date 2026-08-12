/**
 * Uzbek date/time formatting.
 *
 * `toLocaleDateString('uz-UZ')` cannot be trusted here: Chrome's CLDR data for
 * uz renders short months as "M08", so a card would read "M08 13, 13:11"
 * instead of "13-avgust". Dates are the single most-read field on an activity,
 * so the month names are spelled out explicitly.
 */
const MONTHS_GENITIVE = [
  'yanvar',
  'fevral',
  'mart',
  'aprel',
  'may',
  'iyun',
  'iyul',
  'avgust',
  'sentabr',
  'oktabr',
  'noyabr',
  'dekabr',
]

const WEEKDAYS = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba']

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** 24-hour clock, zero-padded — the convention everywhere in Uzbekistan. */
export function formatTime(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value

  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/** "13-avgust", plus the year when it is not the current one. */
export function formatDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  const base = `${date.getDate()}-${MONTHS_GENITIVE[date.getMonth()]}`

  return date.getFullYear() === new Date().getFullYear() ? base : `${base} ${date.getFullYear()}`
}

/**
 * How an activity's start reads on a card: "Bugun, 20:00", "Ertaga, 09:30",
 * "Payshanba, 18:00" within the coming week, then "13-avgust, 18:00".
 */
export function formatActivityStart(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  const now = new Date()

  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)

  if (isSameDay(date, now)) return `Bugun, ${formatTime(date)}`
  if (isSameDay(date, tomorrow)) return `Ertaga, ${formatTime(date)}`

  const daysAhead = Math.floor((date.getTime() - now.getTime()) / 86_400_000)
  if (daysAhead > 0 && daysAhead < 7) {
    return `${WEEKDAYS[date.getDay()]}, ${formatTime(date)}`
  }

  return `${formatDate(date)}, ${formatTime(date)}`
}

/** Full form for detail pages: "13-avgust, payshanba · 20:00". */
export function formatActivityStartLong(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value

  return `${formatDate(date)}, ${WEEKDAYS[date.getDay()]} · ${formatTime(date)}`
}

/** Short, absolute form for ledgers and lists: "13-avgust, 20:00". */
export function formatDateTime(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value

  return `${formatDate(date)}, ${formatTime(date)}`
}

/**
 * Thousands separated by a space, the Uzbek convention: "50 000", not the
 * "50,000" that `toLocaleString('uz-UZ')` produces in Chrome.
 */
export function formatNumber(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

/** "50 000 UZS" — amounts in Rivex are always whole som. */
export function formatMoney(value: number, currency = 'UZS'): string {
  return `${formatNumber(value)} ${currency}`
}

/**
 * "3 daq oldin". Coarse on purpose — a notification list needs recency, not
 * precision, and anything older than a day reads better as a count of days.
 *
 * Lived as a private copy inside NotificationBell until the notification centre
 * needed the same thing.
 */
export function timeAgo(value: string | Date): string {
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000)

  if (seconds < 60) return 'hozir'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} daq oldin`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} soat oldin`
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)} kun oldin`

  return formatDate(value)
}
