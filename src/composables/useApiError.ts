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
