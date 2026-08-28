import axios from 'axios'
import { clientTimezone } from '@/lib/datetime'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    Accept: 'application/json',
  },
})

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('rivex_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  /**
   * Which clock this browser is on.
   *
   * A safety net, not the mechanism: timestamps are sent as UTC ISO-8601 with
   * a `Z`, which needs no header to be unambiguous. This is what stops a
   * timestamp written without an offset — by an older build, or a hand-rolled
   * request — from being read on the server's clock and landing hours out. See
   * ValidatesActivityDetails::clientTimezone() for the receiving half.
   */
  config.headers['X-Timezone'] = clientTimezone()

  return config
})

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('rivex_token')
      if (!location.pathname.startsWith('/auth')) {
        location.href = '/auth/login'
      }
    }
    return Promise.reject(error)
  },
)

export default client
