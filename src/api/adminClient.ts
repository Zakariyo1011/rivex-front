import axios from 'axios'

const adminClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    Accept: 'application/json',
  },
})

adminClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('rivex_admin_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

adminClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('rivex_admin_token')
      if (!location.pathname.startsWith('/admin/login')) {
        location.href = '/admin/login'
      }
    }
    return Promise.reject(error)
  },
)

export default adminClient
