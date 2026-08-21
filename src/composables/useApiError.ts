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
