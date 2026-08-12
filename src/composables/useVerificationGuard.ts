import { isAxiosError } from 'axios'
import { useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'

/** Machine-readable codes the API returns with a 403 verification refusal. */
type VerificationCode = 'phone_verification_required' | 'identity_verification_required'

interface VerificationRefusal {
  message: string
  code: VerificationCode
}

function asRefusal(error: unknown): VerificationRefusal | null {
  if (!isAxiosError(error) || error.response?.status !== 403) return null

  const data = error.response.data as Partial<VerificationRefusal> | undefined

  return data?.code === 'phone_verification_required' || data?.code === 'identity_verification_required'
    ? { message: data.message ?? '', code: data.code }
    : null
}

/**
 * Turns a "you are not verified enough" API refusal into a route, instead of a
 * dead-end error message.
 *
 * The backend is the authority on these rules — the UI hides gated buttons as a
 * courtesy, but a user who reaches the endpoint anyway (stale page, direct
 * call) still gets sent to the screen that actually unblocks them.
 */
export function useVerificationGuard() {
  const router = useRouter()
  const toast = useToast()

  /** @returns true if the error was a verification refusal and was handled. */
  function handle(error: unknown): boolean {
    const refusal = asRefusal(error)
    if (!refusal) return false

    toast.info(refusal.message)

    router.push({
      name: refusal.code === 'phone_verification_required' ? 'verify-phone' : 'verification-intro',
    })

    return true
  }

  return { handle, isVerificationRefusal: (error: unknown) => asRefusal(error) !== null }
}
