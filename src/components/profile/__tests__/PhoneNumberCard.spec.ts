import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/composables/useEcho', () => ({
  disconnectEcho: vi.fn(),
  onEchoReconnect: vi.fn(),
  getEcho: vi.fn(() => null),
}))

const success = vi.fn()
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ success, error: vi.fn(), info: vi.fn() }),
}))

const requestPhone = vi.fn()
const confirmPhone = vi.fn()

vi.mock('@/api/auth', () => ({
  authApi: {
    me: vi.fn(),
    logout: vi.fn(),
    logoutAll: vi.fn(),
    security: vi.fn(),
    deleteAccount: vi.fn(),
    googleStatus: vi.fn(),
    googleRedirect: vi.fn(),
    googleCallback: vi.fn(),
    googleLink: vi.fn(),
    changePassword: vi.fn(),
  },
  phoneApi: {
    show: vi.fn(),
    request: (...args: unknown[]) => requestPhone(...args),
    confirm: (...args: unknown[]) => confirmPhone(...args),
    resend: vi.fn(),
    cancelPending: vi.fn(),
    remove: vi.fn(),
  },
}))

const PhoneNumberCard = (await import('../PhoneNumberCard.vue')).default
const { useAuthStore } = await import('@/stores/auth')

function render() {
  return mount(PhoneNumberCard, {
    global: { stubs: { FontAwesomeIcon: true, teleport: true } },
  })
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('PhoneNumberCard', () => {
  /** Four states, four different things to render. */
  it('says the number is missing when there is none', () => {
    useAuthStore().setPhoneState({
      status: 'not_added',
      phone: null,
      pending_phone: null,
      verified: false,
    })

    const text = render().text()

    expect(text).toContain('Kiritilmagan')
    expect(text).toContain("Qo'shilmagan")

    // Why it matters, stated before the user is refused an activity.
    expect(text).toContain('Faoliyat yaratish')
  })

  it('shows the verified number and badge', () => {
    useAuthStore().setPhoneState({
      status: 'verified',
      phone: '+998901234567',
      pending_phone: null,
      verified: true,
      formatted: '+998 90 123 45 67',
    })

    const text = render().text()

    expect(text).toContain('+998 90 123 45 67')
    expect(text).toContain('Tasdiqlangan')
  })

  it('shows a change in flight without losing the confirmed number', () => {
    useAuthStore().setPhoneState({
      status: 'pending',
      phone: null,
      pending_phone: '+998902222222',
      verified: false,
      pending_formatted: '+998 90 222 22 22',
    })

    const text = render().text()

    expect(text).toContain('+998 90 222 22 22')
    expect(text).toContain('Tasdiqlanmoqda')
  })

  it('walks the two-step flow and reports success', async () => {
    const auth = useAuthStore()
    auth.setPhoneState({
      status: 'not_added',
      phone: null,
      pending_phone: null,
      verified: false,
    })

    requestPhone.mockResolvedValue({
      data: {
        message: 'Tasdiqlash kodi yuborildi.',
        data: {
          status: 'pending',
          phone: null,
          pending_phone: '+998901234567',
          verified: false,
        },
        phone: '+998901234567',
      },
    })

    confirmPhone.mockResolvedValue({
      data: {
        message: 'Telefon raqam tasdiqlandi.',
        data: {
          status: 'verified',
          phone: '+998901234567',
          pending_phone: null,
          verified: true,
        },
        user: {},
      },
    })

    // fetchMe runs after confirmation; it must not fail the flow.
    const { authApi } = await import('@/api/auth')
    vi.mocked(authApi.me).mockRejectedValue(new Error('not needed'))

    const view = render()

    await view.get('[data-testid="phone-row"]').trigger('click')
    await view.get('input[data-testid="phone-input"]').setValue('+998901234567')
    await view.findAll('button').filter((b) => b.text().includes('Kod yuborish'))[0]!.trigger('click')
    await flushPromises()

    expect(requestPhone).toHaveBeenCalledWith('+998901234567')

    await view.get('input[data-testid="phone-code-input"]').setValue('123456')
    await view.findAll('button').filter((b) => b.text().includes('Tasdiqlash'))[0]!.trigger('click')
    await flushPromises()

    // Only the code is sent: the number being confirmed is the one the SERVER
    // recorded, never one the client supplies now.
    expect(confirmPhone).toHaveBeenCalledWith('123456')
    expect(success).toHaveBeenCalledWith('Telefon raqam tasdiqlandi.')
  })

  it('will not send a code for an obviously incomplete number', async () => {
    useAuthStore().setPhoneState({
      status: 'not_added',
      phone: null,
      pending_phone: null,
      verified: false,
    })

    const view = render()

    await view.get('[data-testid="phone-row"]').trigger('click')
    await view.get('input[data-testid="phone-input"]').setValue('123')
    await view.findAll('button').filter((b) => b.text().includes('Kod yuborish'))[0]!.trigger('click')
    await flushPromises()

    expect(requestPhone).not.toHaveBeenCalled()
  })
})
