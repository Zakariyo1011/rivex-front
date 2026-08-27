import { isAxiosError } from 'axios'

export function extractErrorMessage(error: unknown, fallback = "Xatolik yuz berdi. Qayta urinib ko'ring."): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as { message?: string; errors?: Record<string, string[]> } | undefined
    if (data?.errors) {
      const first = Object.values(data.errors)[0]
      if (first?.[0]) return first[0]
    }
    if (data?.message) return data.message
  }
  return fallback
}

/**
 * Laravel's per-field validation errors, flattened to one message each.
 *
 * `extractErrorMessage` above answers "what went wrong" for a toast; this
 * answers "which field" so the form can point at it. Both read the same 422
 * body, and neither decides anything — the server is the authority on what is
 * valid and this only renders its answer next to the input it belongs to.
 *
 * Returns an empty object for any failure that is not a validation error, so a
 * caller can apply it unconditionally.
 */
export function extractFieldErrors(error: unknown): Record<string, string> {
  const errors = (error as { response?: { data?: { errors?: Record<string, string[]> } } })
    ?.response?.data?.errors

  if (!errors || typeof errors !== 'object') return {}

  return Object.fromEntries(
    Object.entries(errors)
      .filter(([, messages]) => Array.isArray(messages) && messages.length > 0)
      .map(([field, messages]) => [field, messages[0] as string]),
  )
}

/**
 * A user-safe description of why a request failed, by status.
 *
 * ## Why `extractErrorMessage` is not enough on its own
 *
 * That function returns `response.data.message` whenever there is one — which
 * is exactly right for a 422, where the message was written for the user, and
 * exactly wrong for a 500, where it is whatever the exception said. In local
 * development a failed chat send surfaced
 * "Pusher error: cURL error 7: Failed to connect to localhost port 8080" to the
 * person typing, which tells them nothing and leaks the shape of the
 * infrastructure. In production the same path would surface a stack-trace
 * message or, with debug off, a bare "Server Error".
 *
 * So the server's own words are trusted for the statuses that are *about the
 * user* (422 validation, 403 permission, 429 rate limit) and replaced with a
 * plain sentence for the ones that are about the system.
 *
 * The real error is always written to the console, so nothing is lost for
 * whoever is debugging — it just is not shown to the person sending a message.
 *
 * @param context short label for the console line, e.g. "message send"
 */
export function describeApiError(error: unknown, context = 'request'): string {
  // Always keep the truth somewhere a developer can find it.
  console.error(`[rivex] ${context} failed`, error)

  if (!isAxiosError(error)) {
    return "Xatolik yuz berdi. Qayta urinib ko'ring."
  }

  const status = error.response?.status

  // No response at all: the request never reached the server, or the browser
  // is offline. Worth saying, because retrying immediately is pointless.
  if (status === undefined) {
    return "Serverga ulanib bo'lmadi. Internet aloqasini tekshiring."
  }

  switch (true) {
    // Written for the user by the server; showing it is the whole point.
    case status === 422:
      return extractErrorMessage(error, "Ma'lumot noto'g'ri kiritilgan.")

    case status === 401:
      return 'Sessiya tugadi. Qaytadan kiring.'

    case status === 403:
      return extractErrorMessage(error, "Bu amalni bajarishga ruxsatingiz yo'q.")

    case status === 404:
      return 'Topilmadi — u o‘chirilgan bo‘lishi mumkin.'

    case status === 409:
      return 'Bu amal allaqachon bajarilgan.'

    case status === 429:
      return "Juda ko'p urinish. Biroz kutib, qayta urinib ko'ring."

    // Deliberately generic. See the docblock: the server's message here is
    // about the server, not about the user.
    case status >= 500:
      return "Serverda xatolik. Birozdan so'ng qayta urinib ko'ring."

    default:
      return extractErrorMessage(error)
  }
}
