import { computed, ref, watch, type Ref } from 'vue'
import { profileApi } from '@/api/profile'

/**
 * The live handle check, shared by onboarding and the profile editor.
 *
 * It exists as a composable rather than as code in the two screens because the
 * shape rule below is a *copy* of a server rule. One copy that two screens read
 * can be compared against `App\Rules\ValidUsername` and kept honest; two copies
 * drift, and the way that failure shows up is a screen that accepts a handle
 * the API then refuses, or refuses one the API would have taken.
 *
 * The check is advisory in the same sense the endpoint is: it answers about the
 * *handle*, never about the caller's right to change it. Cooldown is a separate
 * question with a separate answer — see `UsernameStatus` consumers, which gate
 * submission on the policy served beside /me.
 */

/**
 * First and last character alphanumeric, 3–30 overall.
 *
 * Mirrors ValidUsername: `[a-z0-9_]` only (ASCII, so a Cyrillic "а" cannot
 * impersonate a Latin "a"), no leading or trailing underscore. The doubled
 * underscore and all-digits rules are checked separately below, because a
 * single regex would collapse three distinct complaints into one useless
 * "invalid username".
 */
const FORMAT = /^[a-z0-9](?:[a-z0-9_]{1,28})[a-z0-9]$/

export type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken'

/**
 * Why a handle cannot be used, phrased as what to do instead.
 *
 * Returns null when the shape is fine — which is not the same as "free", only
 * "worth asking the server about".
 */
export function localComplaint(value: string): string | null {
  if (value.length < 3) return "Kamida 3 ta belgi bo'lishi kerak."
  if (value.length > 30) return '30 ta belgidan oshmasligi kerak.'
  if (!FORMAT.test(value)) return 'Faqat lotin harflari, raqamlar va pastki chiziq.'
  if (value.includes('__')) return "Ketma-ket ikkita pastki chiziq bo'lmasligi kerak."
  if (/^\d+$/.test(value)) return "Faqat raqamlardan iborat bo'la olmaydi."
  return null
}

export interface UsernameCheckOptions {
  /**
   * The handle already held, if any. Re-typing it is neither available nor
   * taken — there is nothing to claim — so the check reports `idle` and the
   * caller's submit button stays off.
   */
  current?: Ref<string | null | undefined>
}

export function useUsernameCheck(raw: Ref<string>, options: UsernameCheckOptions = {}) {
  const status = ref<UsernameStatus>('idle')
  const reason = ref<string | null>(null)

  const normalised = computed(() => raw.value.trim().toLowerCase())
  const isCurrent = computed(
    () => !!normalised.value && normalised.value === (options.current?.value ?? null),
  )

  let token = 0
  let debounce: ReturnType<typeof setTimeout> | undefined

  watch(normalised, (value) => {
    clearTimeout(debounce)

    if (!value || isCurrent.value) {
      // An empty field is not unavailable, it is unanswered; and the handle
      // someone already holds is not a claim at all.
      status.value = 'idle'
      reason.value = null
      // Invalidate any in-flight response so it cannot land on this state.
      token++
      return
    }

    const complaint = localComplaint(value)
    if (complaint) {
      status.value = 'taken'
      reason.value = complaint
      token++
      return
    }

    status.value = 'checking'
    const mine = ++token

    // Every keystroke would otherwise be a request, and the endpoint is rate
    // limited precisely because it answers an existence question. The token
    // guards against an earlier, slower response overwriting a later one.
    debounce = setTimeout(async () => {
      try {
        const { data } = await profileApi.checkUsername(value)
        if (mine !== token) return

        status.value = data.available ? 'available' : 'taken'
        reason.value = data.reason
      } catch {
        if (mine !== token) return
        // A failed check is not a taken handle. Let them try to submit; the
        // server decides for real.
        status.value = 'idle'
        reason.value = null
      }
    }, 350)
  })

  /** Force the rejected state after the server refuses a write. */
  function reject(message: string) {
    token++
    status.value = 'taken'
    reason.value = message
  }

  return { normalised, isCurrent, status, reason, reject }
}
