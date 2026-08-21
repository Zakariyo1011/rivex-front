import { icons } from './icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import type { Activity, PaymentType } from '@/types'

/**
 * Everything the create and edit screens both need to agree about.
 *
 * The two screens are laid out differently on purpose — creating is a wizard
 * that walks somebody through decisions they have not made yet, editing is one
 * page because you arrive knowing the single thing you came to change. That is
 * a presentation difference and it is fine. What must *not* differ is the
 * meaning of the fields: which payment types exist, what a valid form is, and
 * how the values become a request body. All of that lives here so there is one
 * copy of it rather than one per screen.
 */

export interface ActivityFormState {
  title: string
  category_id: number | null
  description: string
  location_name: string
  region_id: number | null
  district_id: number | null
  /**
   * The optional precise meeting point. Never typed — see LocationPicker.
   * Always both or neither: the server refuses a lone coordinate, because a
   * single stored value drops the activity out of every radius search while the
   * map card still claims an exact location exists.
   */
  latitude: number | null
  longitude: number | null
  date: string
  time: string
  duration_minutes: string | number
  people_needed: number
  payment_type: PaymentType
  amount: number
  /** Cover image. Optional; the API has always accepted one, nothing sent it. */
  image: File | null
}

/** How far ahead an activity may be scheduled — mirrors the server's rule. */
export const MAX_MONTHS_AHEAD = 12

/** The bounds the server enforces on a meet-up's length. */
export const MIN_DURATION_MINUTES = 15
export const MAX_DURATION_MINUTES = 1440

export const MAX_PEOPLE_NEEDED = 50

/** An empty form, with the defaults a new activity starts from. */
export function emptyActivityForm(): ActivityFormState {
  return {
    title: '',
    category_id: null,
    description: '',
    location_name: '',
    region_id: null,
    district_id: null,
    latitude: null,
    longitude: null,
    date: '',
    time: '',
    duration_minutes: '',
    people_needed: 1,
    payment_type: 'free',
    amount: 0,
    image: null,
  }
}

/**
 * A sensible first start time: the next whole hour, at least an hour away.
 *
 * 🔴 The create screen used to seed this with `toISOString().slice(0, 10)` for
 * the date and `toTimeString().slice(0, 5)` for the time — a **UTC** date beside
 * a **local** time. In UTC+5 that is wrong for the last five hours of every day:
 * at 21:00 on the 3rd the form opened on "the 3rd at 21:00" as far as the time
 * went, but ISO had already rolled to... no — it opened on the 3rd's date with
 * a 21:00 time while UTC was still the 3rd at 16:00, and after midnight local
 * the date lagged a full day behind, pre-filling a start time in the past and
 * failing validation on a form the user had not touched.
 *
 * Both halves are read from the same local clock here, so they cannot disagree.
 */
export function defaultStartAt(now: Date = new Date()): { date: string; time: string } {
  const start = new Date(now.getTime() + 60 * 60 * 1000)
  start.setMinutes(0, 0, 0)

  // Rounding down could land in the past when `now` is already past the hour.
  if (start.getTime() <= now.getTime()) start.setHours(start.getHours() + 1)

  const pad = (n: number) => String(n).padStart(2, '0')

  return {
    date: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    time: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
  }
}

export const paymentOptions: {
  value: PaymentType
  label: string
  hint: string
  icon: IconDefinition
}[] = [
  { value: 'free', label: 'Bepul', hint: "To'lov yo'q", icon: icons.free },
  {
    value: 'shared_cost',
    label: 'Umumiy xarajat',
    hint: "Hamma o'z ulushini to'laydi",
    icon: icons.amount,
  },
  { value: 'owner_pays', label: "Men to'layman", hint: "Sherikka men to'layman", icon: icons.ownerPays },
  {
    value: 'participant_pays',
    label: "Sherik to'laydi",
    hint: "Qatnashuvchi menga to'laydi",
    icon: icons.payment,
  },
]

/**
 * What to ask for, given the kind of activity.
 *
 * ## Why this is copy and not columns
 *
 * The obvious reading of "the form should adapt to the activity type" is a
 * column per type — `distance_km`, `skill_level`, `movie_title`, `subject`.
 * That is schema bloat with a long tail: every new category needs a migration,
 * every column is null for the other ninety percent of activities, and the
 * search and feed queries have to learn to ignore all of them.
 *
 * The domain already has the field for this and it is `description`. What was
 * actually missing is that nobody told the organiser *what to put in it* — the
 * placeholder said "describe your activity", which is the least useful prompt
 * available. So the adaptation is in the prompting: a PlayStation meet-up is
 * asked which game and what level, a run is asked the distance and the pace, a
 * restaurant is asked where to meet and who pays.
 *
 * Matched on the category slug's stem, so subcategories inherit their shelf's
 * prompt without needing their own entry.
 */
interface CategoryGuidance {
  titleHint: string
  descriptionHint: string
  /** What "people needed" means for this kind of thing. */
  peopleHint?: string
}

const GUIDANCE: Record<string, CategoryGuidance> = {
  gaming: {
    titleHint: 'Masalan: FIFA 24 — PS5 da 1v1',
    descriptionHint:
      "Qaysi o'yin, qaysi konsol, qanday daraja? Jihoz sizdami yoki olib kelish kerakmi?",
    peopleHint: "Nechta o'yinchi kerak?",
  },
  sport: {
    titleHint: 'Masalan: Chorshanba kuni 5 km yugurish',
    descriptionHint: 'Masofa, temp va daraja qanday? Nima olib kelish kerak?',
    peopleHint: 'Nechta sherik kerak?',
  },
  food: {
    titleHint: "Masalan: Kechki ovqat — yangi kafe'da",
    descriptionHint:
      "Qayerda uchrashamiz, qaysi taom? Hisob qanday bo'linadi — buni quyida ham belgilaysiz.",
    peopleHint: 'Nechta kishi kutilyapti?',
  },
  cinema: {
    titleHint: 'Masalan: Yangi film — shanba kuni seans',
    descriptionHint: 'Qaysi film va qaysi seans? Chiptani kim oladi?',
  },
  travel: {
    titleHint: 'Masalan: Chimyonga bir kunlik sayohat',
    descriptionHint:
      "Uchrashuv joyi, manzil va qaytish vaqti qanday? Transport bormi, xarajat qancha?",
    peopleHint: "Nechta yo'lovchi joy bor?",
  },
  education: {
    titleHint: 'Masalan: IELTS speaking — birga mashq',
    descriptionHint: 'Qaysi mavzu yoki fan? Qanday daraja kutilyapti, nima olib kelish kerak?',
  },
}

const FALLBACK: CategoryGuidance = {
  titleHint: 'Faoliyatingizni qisqa va aniq nomlang',
  descriptionHint:
    "Nima qilasiz, qayerda uchrashasiz va ishtirokchi nimani kutishi kerak? Qancha aniq bo'lsa, shuncha ko'p odam qo'shiladi.",
}

/**
 * @param slug the selected category's slug, or the parent's when a
 *   subcategory is chosen — either resolves to the same shelf.
 */
export function guidanceFor(slug: string | null | undefined): CategoryGuidance {
  if (!slug) return FALLBACK

  const stem = slug.split('-')[0] ?? ''

  return GUIDANCE[stem] ?? FALLBACK
}

/** The request body, from the form state. One conversion, both screens. */
export function toActivityPayload(form: ActivityFormState) {
  const hasPin = form.latitude !== null && form.longitude !== null

  return {
    title: form.title.trim(),
    category_id: form.category_id!,
    description: form.description.trim() || undefined,
    location_name: form.location_name.trim(),
    region_id: form.region_id!,
    district_id: form.district_id ?? undefined,
    // Both or neither — a lone coordinate is refused server-side, and sending
    // one would turn a helpful extra into a failed submission.
    latitude: hasPin ? form.latitude! : undefined,
    longitude: hasPin ? form.longitude! : undefined,
    start_at: `${form.date} ${form.time}:00`,
    duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : undefined,
    people_needed: form.people_needed,
    payment_type: form.payment_type,
    // The server rejects a non-zero amount on a free activity; sending zero
    // rather than whatever was typed before "Bepul" was picked keeps the two
    // in step without the user having to clear the field.
    amount: form.payment_type === 'free' ? 0 : Number(form.amount),
    image: form.image ?? undefined,
  }
}

/** Fill a form from an activity being edited. */
export function fromActivity(activity: Activity): ActivityFormState {
  const start = new Date(activity.start_at)
  const pad = (n: number) => String(n).padStart(2, '0')

  const latitude = activity.latitude === null ? null : Number(activity.latitude)
  const longitude = activity.longitude === null ? null : Number(activity.longitude)

  return {
    title: activity.title,
    category_id: activity.category?.id ?? null,
    description: activity.description ?? '',
    location_name: activity.location_name ?? '',
    region_id: activity.location?.region?.id ?? null,
    district_id: activity.location?.district?.id ?? null,
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    date: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    time: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
    duration_minutes: activity.duration_minutes ?? '',
    people_needed: activity.people_needed,
    payment_type: activity.payment_type,
    amount: activity.amount ?? 0,
    image: null,
  }
}

/**
 * Which fields are not yet acceptable, keyed by field name.
 *
 * Advisory only — the server validates the same things and is the authority.
 * This exists so the form can point at the problem before a round trip, not so
 * the client can decide what is allowed.
 */
export function validateActivityForm(
  form: ActivityFormState,
  options: { minPeople?: number } = {},
): Record<string, string> {
  const errors: Record<string, string> = {}
  const minPeople = options.minPeople ?? 1

  const title = form.title.trim()

  if (!title) errors.title = 'Nom kiritilishi kerak.'
  else if (title.length < 3) errors.title = "Nom kamida 3 ta belgidan iborat bo'lsin."
  else if (title.length > 150) errors.title = 'Nom 150 belgidan oshmasligi kerak.'

  if (form.description.trim().length > 2000) {
    errors.description = "Tavsif 2000 belgidan oshmasligi kerak."
  }

  if (!form.category_id) errors.category_id = 'Turini tanlang.'

  const locationName = form.location_name.trim()

  if (!locationName) errors.location_name = 'Uchrashuv joyini kiriting.'
  else if (locationName.length < 3) errors.location_name = "Joy nomi juda qisqa."

  if (!form.region_id) errors.region_id = 'Viloyatni tanlang.'

  if (!form.date || !form.time) {
    errors.start_at = 'Sana va vaqtni tanlang.'
  } else {
    const startAt = new Date(`${form.date}T${form.time}`).getTime()
    const horizon = new Date()
    horizon.setMonth(horizon.getMonth() + MAX_MONTHS_AHEAD)

    if (Number.isNaN(startAt)) errors.start_at = "Sana yoki vaqt noto'g'ri."
    else if (startAt <= Date.now()) errors.start_at = "Boshlanish vaqti kelajakda bo'lishi kerak."
    else if (startAt > horizon.getTime()) {
      errors.start_at = `Faoliyatni ko'pi bilan ${MAX_MONTHS_AHEAD} oy oldindan rejalashtirish mumkin.`
    }
  }

  if (form.duration_minutes !== '' && form.duration_minutes !== null) {
    const duration = Number(form.duration_minutes)

    if (!Number.isFinite(duration) || duration < MIN_DURATION_MINUTES) {
      errors.duration_minutes = `Kamida ${MIN_DURATION_MINUTES} daqiqa.`
    } else if (duration > MAX_DURATION_MINUTES) {
      errors.duration_minutes = "Ko'pi bilan 24 soat."
    }
  }

  if (!Number.isInteger(form.people_needed) || form.people_needed < minPeople) {
    errors.people_needed =
      minPeople > 1
        ? `Faoliyatda allaqachon ${minPeople} ta ishtirokchi bor.`
        : 'Kamida 1 kishi kerak.'
  } else if (form.people_needed > MAX_PEOPLE_NEEDED) {
    errors.people_needed = `Ko'pi bilan ${MAX_PEOPLE_NEEDED} kishi.`
  }

  if (form.payment_type !== 'free' && Number(form.amount) <= 0) {
    errors.amount = 'Pullik faoliyat uchun summani kiriting.'
  }

  if (form.payment_type === 'free' && Number(form.amount) !== 0) {
    errors.amount = "Bepul faoliyat uchun summa 0 bo'lishi kerak."
  }

  // A half coordinate cannot be produced by the picker, but it can arrive from
  // restored state or a future caller — and the server refuses it, so the form
  // should say so first rather than let a submission fail on it.
  if ((form.latitude === null) !== (form.longitude === null)) {
    errors.latitude = "Koordinata to'liq emas."
  }

  return errors
}

/**
 * Which step of the create wizard owns each field.
 *
 * So a validation failure can send somebody to the screen that has the problem
 * instead of leaving them on the review step reading about a field they cannot
 * see. Server-side field errors use the same map, which is why it is keyed by
 * the API's field names rather than the form's.
 */
export const FIELD_STEP: Record<string, number> = {
  title: 1,
  category_id: 1,
  description: 1,
  image: 1,
  start_at: 2,
  duration_minutes: 2,
  location_name: 3,
  region_id: 3,
  district_id: 3,
  latitude: 3,
  longitude: 3,
  people_needed: 4,
  payment_type: 5,
  amount: 5,
}

/** The earliest step carrying one of these errors, or null when there are none. */
export function firstStepWithError(errors: Record<string, string | undefined>): number | null {
  const steps = Object.keys(errors)
    .filter((field) => errors[field])
    .map((field) => FIELD_STEP[field])
    .filter((step): step is number => step !== undefined)

  return steps.length ? Math.min(...steps) : null
}
