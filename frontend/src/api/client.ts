import axios from 'axios'
import { getActivePinia } from 'pinia'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api',
  withCredentials: true,
})

// On 401 from any endpoint except /auth/login, clear local session and redirect to login.
// Dynamic imports avoid a circular dependency (client ← authStore ← auth ← client).
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const isLoginEndpoint = (error.config?.url as string | undefined)?.endsWith('/auth/login')
    if (error.response?.status === 401 && !isLoginEndpoint) {
      const pinia = getActivePinia()
      if (pinia) {
        const { useAuthStore } = await import('@/stores/authStore')
        useAuthStore(pinia).clearSession()
      }
      const { default: router } = await import('@/router')
      router.push('/login')
    }
    return Promise.reject(error)
  },
)

export default apiClient
