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
 * The user's own IANA timezone, as the browser reports it.
 *
 * Sent to the API as `X-Timezone` so a timestamp written without an offset is
 * still read on the right clock. See `toApiTimestamp` for the primary path,
 * which does not depend on this at all.
 */
export function clientTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/**
 * A date input and a time input, as the exact moment they name.
 *
 * ------------------------------------------------------------------------
 * 🔴 THE BUG THIS FIXES
 * ------------------------------------------------------------------------
 *
 * The create form used to send `` `${date} ${time}:00` `` — "2026-09-10
 * 18:00:00", a wall-clock reading with nothing in it to say which clock. The
 * API's timezone is UTC, so 18:00 was stored as 18:00 UTC and returned as
 * `18:00Z`, which this same browser then rendered as **23:00**. Somebody
 * arranging a meet-up for six in the evening published one for eleven at
 * night, and the reminder, the card and the "starting soon" sort all agreed
 * with the wrong answer.
 *
 * `<input type="date">` and `<input type="time">` both yield local values, so
 * building a `Date` from them and asking for its ISO form is the conversion:
 * `toISOString()` returns UTC with a `Z`, which is unambiguous and is what the
 * API stores. The round trip is then exact — 18:00 in Tashkent goes out as
 * 13:00Z and comes back as 13:00Z, which `formatTime` renders as 18:00.
 *
 * Returns null for an incomplete or unparseable pair rather than a guess;
 * guessing is what produced the five-hour drift in the first place.
 */
export function toApiTimestamp(date: string, time: string): string | null {
  if (!date || !time) return null

  const at = new Date(`${date}T${time}`)

  return Number.isNaN(at.getTime()) ? null : at.toISOString()
}

/**
 * The reverse: an API timestamp back into the two form fields that made it.
 *
 * Local on both halves, from the same `Date`, so they cannot disagree with each
 * other the way a UTC date beside a local time once did.
 */
export function fromApiTimestamp(value: string): { date: string; time: string } {
  const at = new Date(value)
  const pad = (n: number) => String(n).padStart(2, '0')

  return {
    date: `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`,
    time: `${pad(at.getHours())}:${pad(at.getMinutes())}`,
  }
}

/**
 * "28-avgust, juma" — a date with its weekday, spelled out.
 *
 * 🔴 The create wizard used `toLocaleDateString('uz-UZ', { weekday, day, month })`
 * for this, which is exactly what the note at the top of this file warns
 * against: Chrome's CLDR data for `uz` has no real month names, so the form
 * previewed a start of **"M08 28, Fri"** — a machine code and an English
 * weekday, on the screen where somebody confirms when their meet-up is.
 *
 * Built from the same two tables every other formatter here uses, so the
 * wizard, the card and the detail page cannot disagree about what a date
 * looks like.
 */
export function formatDayLong(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value

  return `${formatDate(date)}, ${WEEKDAYS[date.getDay()]}`
}

/**
 * When an activity runs: "18:00 — 20:00".
 *
 * An em dash rather than a hyphen because this is a range, and the two are
 * visually distinct at the sizes this renders at. An activity that crosses
 * midnight says which day it ends on, because "23:00 — 01:00" otherwise reads
 * as a twenty-two-hour event running backwards.
 */
export function formatTimeRange(start: string | Date, end: string | Date): string {
  const from = typeof start === 'string' ? new Date(start) : start
  const to = typeof end === 'string' ? new Date(end) : end

  if (!isSameDay(from, to)) {
    return `${formatTime(from)} — ${formatDate(to)}, ${formatTime(to)}`
  }

  return `${formatTime(from)} — ${formatTime(to)}`
}

/** "1 soat 30 daq", "45 daq" — a length, spoken the way a length is. */
export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return ''

  const hours = Math.floor(minutes / 60)
  const rest = Math.round(minutes % 60)

  if (hours === 0) return `${rest} daq`
  if (rest === 0) return `${hours} soat`

  return `${hours} soat ${rest} daq`
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
