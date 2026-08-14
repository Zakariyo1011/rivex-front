import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { localComplaint, useUsernameCheck } from '@/composables/useUsernameCheck'

const checkUsername = vi.fn()

vi.mock('@/api/profile', () => ({
  profileApi: {
    checkUsername: (username: string) => checkUsername(username),
  },
}))

/**
 * The composable holds a client-side copy of a server rule
 * (`App\Rules\ValidUsername`). These tests are the thing that keeps the copy
 * honest — a divergence shows up as a screen that accepts a handle the API
 * refuses, or refuses one it would have taken, and neither is visible from the
 * backend suite.
 */
describe('useUsernameCheck', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    checkUsername.mockReset()
    checkUsername.mockResolvedValue({ data: { available: true, reason: null } })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /** Advances past the 350ms debounce and lets the promise settle. */
  async function settle() {
    await vi.advanceTimersByTimeAsync(400)
    await nextTick()
  }

  describe('localComplaint mirrors the server shape rule', () => {
    // Same cases as UsernameTest::invalidUsernames — deliberately, so the two
    // suites can be read against each other.
    it.each([
      ['ab', 'too short'],
      ['a'.repeat(31), 'too long'],
      ['aziz karimov', 'space inside'],
      ['aziz-karimov', 'dash'],
      ['aziz.karimov', 'dot'],
      ['_aziz', 'leading underscore'],
      ['aziz_', 'trailing underscore'],
      ['az__iz', 'double underscore'],
      ['12345', 'all digits'],
      ['аziz', 'cyrillic lookalike'],
      ['aziz🎮', 'emoji'],
    ])('rejects %s (%s)', (value) => {
      expect(localComplaint(value)).not.toBeNull()
    })

    it.each(['aziz', 'aziz_karimov', 'a1b', 'zakariyo_dev', 'a'.repeat(30)])(
      'accepts %s',
      (value) => {
        expect(localComplaint(value)).toBeNull()
      },
    )
  })

  it('treats an empty field as unanswered rather than unavailable', async () => {
    const raw = ref('')
    const { status } = useUsernameCheck(raw)

    raw.value = ''
    await settle()

    expect(status.value).toBe('idle')
    expect(checkUsername).not.toHaveBeenCalled()
  })

  it('rejects a malformed handle without spending a request', async () => {
    const raw = ref('')
    const { status, reason } = useUsernameCheck(raw)

    raw.value = 'Aziz-Karimov'
    await settle()

    expect(status.value).toBe('taken')
    expect(reason.value).toBeTruthy()
    // The endpoint is rate limited because it answers an existence question;
    // a shape we can judge locally must never cost one of those calls.
    expect(checkUsername).not.toHaveBeenCalled()
  })

  it('asks the server about a well-formed handle, lowercased and trimmed', async () => {
    const raw = ref('')
    const { status } = useUsernameCheck(raw)

    raw.value = '  Aziz_Karimov  '
    await settle()

    expect(checkUsername).toHaveBeenCalledWith('aziz_karimov')
    expect(status.value).toBe('available')
  })

  it('reports the server reason when a handle is taken', async () => {
    checkUsername.mockResolvedValue({ data: { available: false, reason: 'Bu nom band.' } })

    const raw = ref('')
    const { status, reason } = useUsernameCheck(raw)

    raw.value = 'support'
    await settle()

    expect(status.value).toBe('taken')
    expect(reason.value).toBe('Bu nom band.')
  })

  it('does not treat the handle already held as a claim', async () => {
    const raw = ref('')
    const { status, isCurrent } = useUsernameCheck(raw, { current: ref('aziz_karimov') })

    raw.value = 'aziz_karimov'
    await settle()

    expect(isCurrent.value).toBe(true)
    expect(status.value).toBe('idle')
    expect(checkUsername).not.toHaveBeenCalled()
  })

  it('does not let a slow earlier answer overwrite a newer one', async () => {
    let resolveFirst: (value: unknown) => void = () => {}

    checkUsername
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve
          }),
      )
      .mockResolvedValueOnce({ data: { available: false, reason: 'Bu nom band.' } })

    const raw = ref('')
    const { status, reason } = useUsernameCheck(raw)

    raw.value = 'first_name'
    await vi.advanceTimersByTimeAsync(400)

    raw.value = 'second_name'
    await settle()

    expect(status.value).toBe('taken')
    expect(reason.value).toBe('Bu nom band.')

    // The first request now answers "available" — for a handle nobody is
    // asking about any more.
    resolveFirst({ data: { available: true, reason: null } })
    await nextTick()

    expect(status.value).toBe('taken')
    expect(reason.value).toBe('Bu nom band.')
  })

  it('falls back to idle when the check fails, so the write can still decide', async () => {
    checkUsername.mockRejectedValue(new Error('network'))

    const raw = ref('')
    const { status, reason } = useUsernameCheck(raw)

    raw.value = 'aziz_karimov'
    await settle()

    // A failed check is not a taken handle.
    expect(status.value).toBe('idle')
    expect(reason.value).toBeNull()
  })

  it('lets a server rejection override the advisory answer', async () => {
    const raw = ref('')
    const { status, reason, reject } = useUsernameCheck(raw)

    raw.value = 'aziz_karimov'
    await settle()
    expect(status.value).toBe('available')

    reject('Bu foydalanuvchi nomi band.')

    expect(status.value).toBe('taken')
    expect(reason.value).toBe('Bu foydalanuvchi nomi band.')
  })
})
