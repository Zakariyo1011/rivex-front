import { describe, it, expect } from 'vitest'
import {
  MAX_MONTHS_AHEAD,
  defaultStartAt,
  emptyActivityForm,
  firstStepWithError,
  fromActivity,
  guidanceFor,
  paymentOptions,
  toActivityPayload,
  validateActivityForm,
  type ActivityFormState,
} from '@/lib/activityForm'
import type { Activity } from '@/types'

/**
 * The shared half of create and edit.
 *
 * The two screens are laid out differently on purpose, so the risk is that they
 * drift on the things that *carry meaning* — what a valid form is, how the
 * fields become a request body. This is the one copy of that, and these pin it.
 */
function form(overrides: Partial<ActivityFormState> = {}): ActivityFormState {
  return {
    title: 'Kechqurun yugurish',
    category_id: 3,
    description: 'QA',
    location_name: 'Tashkent',
    region_id: 1,
    district_id: null,
    date: '2027-01-01',
    time: '18:00',
    duration_minutes: '',
    latitude: null,
    longitude: null,
    people_needed: 2,
    payment_type: 'free',
    amount: 0,
    image: null,
    ...overrides,
  }
}

describe('guidanceFor', () => {
  it('asks a gaming meet-up about the game', () => {
    expect(guidanceFor('gaming').descriptionHint).toContain("o'yin")
  })

  it('asks a run about distance', () => {
    expect(guidanceFor('sport').descriptionHint).toContain('Masofa')
  })

  /** Subcategories inherit their shelf: `sport-running` is still sport. */
  it('resolves a subcategory slug to its shelf', () => {
    expect(guidanceFor('sport-running')).toEqual(guidanceFor('sport'))
  })

  it('falls back to a generic prompt for an unknown category', () => {
    expect(guidanceFor('underwater-basket-weaving').titleHint).toBeTruthy()
    expect(guidanceFor(null).titleHint).toBeTruthy()
  })

  /** The prompt is never empty — an empty placeholder is the old behaviour. */
  it('always returns usable copy', () => {
    for (const slug of ['gaming', 'food', 'cinema', 'travel', 'education', 'nonsense', null]) {
      const g = guidanceFor(slug)
      expect(g.titleHint.length).toBeGreaterThan(0)
      expect(g.descriptionHint.length).toBeGreaterThan(0)
    }
  })
})

describe('toActivityPayload', () => {
  it('combines date and time into a start timestamp', () => {
    expect(toActivityPayload(form()).start_at).toBe('2027-01-01 18:00:00')
  })

  it('trims text and drops an empty description', () => {
    const payload = toActivityPayload(form({ title: '  Yugurish  ', description: '   ' }))

    expect(payload.title).toBe('Yugurish')
    expect(payload.description).toBeUndefined()
  })

  /**
   * The server rejects a non-zero amount on a free activity. Zeroing it here
   * means picking "Bepul" after typing a price does not need the field cleared
   * by hand.
   */
  it('zeroes the amount on a free activity', () => {
    expect(toActivityPayload(form({ payment_type: 'free', amount: 50000 })).amount).toBe(0)
  })

  it('keeps the amount on a paid activity', () => {
    expect(toActivityPayload(form({ payment_type: 'shared_cost', amount: 50000 })).amount).toBe(50000)
  })

  it('omits an unset duration rather than sending zero', () => {
    expect(toActivityPayload(form({ duration_minutes: '' })).duration_minutes).toBeUndefined()
    expect(toActivityPayload(form({ duration_minutes: '90' })).duration_minutes).toBe(90)
  })
})

describe('validateActivityForm', () => {
  it('accepts a complete form', () => {
    expect(validateActivityForm(form())).toEqual({})
  })

  it('requires the fields the server requires', () => {
    const errors = validateActivityForm(
      form({ title: '  ', category_id: null, location_name: '', region_id: null }),
    )

    expect(Object.keys(errors).sort()).toEqual(
      ['category_id', 'location_name', 'region_id', 'title'].sort(),
    )
  })

  it('refuses a start time in the past', () => {
    expect(validateActivityForm(form({ date: '2020-01-01' })).start_at).toBeTruthy()
  })

  it('refuses a paid activity with no price', () => {
    expect(validateActivityForm(form({ payment_type: 'owner_pays', amount: 0 })).amount).toBeTruthy()
  })

  /** Mirrors the server rule that a shrink cannot orphan accepted people. */
  it('refuses fewer seats than people already accepted', () => {
    const errors = validateActivityForm(form({ people_needed: 1 }), { minPeople: 3 })

    expect(errors.people_needed).toContain('3')
  })

  it('allows exactly as many seats as people accepted', () => {
    expect(validateActivityForm(form({ people_needed: 3 }), { minPeople: 3 }).people_needed)
      .toBeUndefined()
  })

  it('caps the roster at fifty', () => {
    expect(validateActivityForm(form({ people_needed: 51 })).people_needed).toBeTruthy()
  })
})

describe('fromActivity', () => {
  it('splits a stored start time back into date and time fields', () => {
    const start = new Date(2027, 0, 5, 9, 30)

    const state = fromActivity({
      title: 'Yugurish',
      description: null,
      category: { id: 3, name: 'Sport', slug: 'sport', icon: null },
      location_name: 'Tashkent',
      location: { region: { id: 7, name: 'Toshkent', code: 'UZ-TK' }, district: null },
      start_at: start.toISOString(),
      duration_minutes: null,
      people_needed: 4,
      payment_type: 'shared_cost',
      amount: 25000,
    } as unknown as Activity)

    expect(state.date).toBe('2027-01-05')
    expect(state.time).toBe('09:30')
    expect(state.category_id).toBe(3)
    expect(state.region_id).toBe(7)
    expect(state.people_needed).toBe(4)
    expect(state.amount).toBe(25000)
    // Null description becomes an empty string, not the literal "null".
    expect(state.description).toBe('')
  })

  /** Loading then saving without touching anything must not change the value. */
  it('round-trips through the payload unchanged', () => {
    const original = form({ duration_minutes: 90, payment_type: 'shared_cost', amount: 30000 })
    const payload = toActivityPayload(original)

    const state = fromActivity({
      title: payload.title,
      description: payload.description ?? null,
      category: { id: payload.category_id, name: 'X', slug: 'sport', icon: null },
      location_name: payload.location_name,
      location: { region: { id: payload.region_id, name: 'R', code: 'C' }, district: null },
      start_at: new Date('2027-01-01T18:00:00').toISOString(),
      duration_minutes: payload.duration_minutes ?? null,
      people_needed: payload.people_needed,
      payment_type: payload.payment_type,
      amount: payload.amount,
    } as unknown as Activity)

    expect(toActivityPayload(state)).toEqual(payload)
  })
})

describe('paymentOptions', () => {
  it('covers exactly the four backend payment types', () => {
    expect(paymentOptions.map((o) => o.value)).toEqual([
      'free',
      'shared_cost',
      'owner_pays',
      'participant_pays',
    ])
  })
})

describe('defaultStartAt', () => {
  /**
   * 🔴 The create screen used to seed the date from `toISOString()` — which is
   * UTC — beside a time from `toTimeString()`, which is local. In UTC+5 the two
   * disagree for the last five hours of every day, so the form opened pre-filled
   * with a moment in the past and refused to submit something nobody had
   * touched. Both halves must come from the same clock.
   */
  it('reads the date and the time from the same local clock', () => {
    // 23:30 local on the 3rd — the window where a UTC date lags a day behind.
    // The suggestion rolls over to the 4th, and the date has to roll with it.
    const at = new Date(2027, 0, 3, 23, 30, 0)
    const { date, time } = defaultStartAt(at)

    expect(date).toBe('2027-01-04')
    expect(time).toBe('00:00')
    expect(new Date(`${date}T${time}`).getTime()).toBeGreaterThan(at.getTime())
  })

  it('never suggests a moment that has already passed', () => {
    for (const hour of [0, 5, 12, 18, 22, 23]) {
      const now = new Date(2027, 5, 10, hour, 45, 0)
      const { date, time } = defaultStartAt(now)

      expect(new Date(`${date}T${time}`).getTime()).toBeGreaterThan(now.getTime())
    }
  })

  it('produces a form that validates', () => {
    const start = defaultStartAt()

    expect(validateActivityForm(form(start))).toEqual({})
  })
})

describe('emptyActivityForm', () => {
  it('starts free, unpinned and with one seat', () => {
    const blank = emptyActivityForm()

    expect(blank.payment_type).toBe('free')
    expect(blank.amount).toBe(0)
    expect(blank.latitude).toBeNull()
    expect(blank.longitude).toBeNull()
    expect(blank.people_needed).toBe(1)
    expect(blank.image).toBeNull()
  })
})

describe('validateActivityForm — the rules the server also enforces', () => {
  it('refuses a start time beyond the scheduling horizon', () => {
    const far = new Date()
    far.setMonth(far.getMonth() + MAX_MONTHS_AHEAD + 2)

    const errors = validateActivityForm(
      form({ date: far.toISOString().slice(0, 10), time: '12:00' }),
    )

    expect(errors.start_at).toBeDefined()
  })

  it('refuses a free activity carrying an amount', () => {
    expect(validateActivityForm(form({ payment_type: 'free', amount: 5000 })).amount).toBeDefined()
  })

  it('refuses a duration outside the accepted range', () => {
    expect(validateActivityForm(form({ duration_minutes: 5 })).duration_minutes).toBeDefined()
    expect(validateActivityForm(form({ duration_minutes: 2000 })).duration_minutes).toBeDefined()
    expect(validateActivityForm(form({ duration_minutes: 90 })).duration_minutes).toBeUndefined()
  })

  it('accepts no duration at all — it is optional', () => {
    expect(validateActivityForm(form({ duration_minutes: '' })).duration_minutes).toBeUndefined()
  })

  it('refuses a title that is too short to mean anything', () => {
    expect(validateActivityForm(form({ title: 'ab' })).title).toBeDefined()
  })

  /**
   * A single stored coordinate is worse than none: the radius filter needs both
   * columns, so the row drops out of every nearby search while the map card
   * still claims an exact location exists. The server refuses it; so does this.
   */
  it('refuses half a coordinate', () => {
    expect(validateActivityForm(form({ latitude: 41.3 })).latitude).toBeDefined()
    expect(validateActivityForm(form({ longitude: 69.2 })).latitude).toBeDefined()
    expect(validateActivityForm(form({ latitude: 41.3, longitude: 69.2 })).latitude).toBeUndefined()
  })
})

describe('toActivityPayload — coordinates', () => {
  it('sends both halves of a pin or neither', () => {
    expect(toActivityPayload(form({ latitude: 41.3, longitude: 69.2 }))).toMatchObject({
      latitude: 41.3,
      longitude: 69.2,
    })

    const unpinned = toActivityPayload(form())

    expect(unpinned.latitude).toBeUndefined()
    expect(unpinned.longitude).toBeUndefined()
  })

  it('never sends a lone coordinate even if the state holds one', () => {
    const half = toActivityPayload(form({ latitude: 41.3 }))

    expect(half.latitude).toBeUndefined()
    expect(half.longitude).toBeUndefined()
  })
})

describe('firstStepWithError', () => {
  /**
   * A 422 on the review step must not leave somebody reading about a field
   * three screens back that they cannot see.
   */
  it('points at the earliest step that has a problem', () => {
    expect(firstStepWithError({ amount: 'x', title: 'y' })).toBe(1)
    expect(firstStepWithError({ amount: 'x', region_id: 'y' })).toBe(3)
    expect(firstStepWithError({ amount: 'x' })).toBe(5)
  })

  it('returns null when nothing is wrong', () => {
    expect(firstStepWithError({})).toBeNull()
    expect(firstStepWithError({ title: undefined })).toBeNull()
  })

  it('ignores a field it does not know about', () => {
    expect(firstStepWithError({ some_future_field: 'x' })).toBeNull()
  })
})
