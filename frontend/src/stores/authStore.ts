import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as authApi from '@/api/auth'
import { useSessionStore } from './sessionStore'
import { usePaymentStore } from './paymentStore'
import { useAttendanceStore } from './attendanceStore'
import { useUserStore } from './userStore'
import { useConfigStore } from './configStore'
import { useNotificationStore } from './notificationStore'
import { useDashboardStore } from './dashboardStore'
import { useTournamentStore } from './tournamentStore'

export type Role = 'admin' | 'teacher' | 'coach' | 'student'

export interface AuthUser {
  id: string
  name: string
  username: string
  role: Role
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const loading = ref(false)
  const initialized = ref(false)

  function resetOtherStores() {
    useSessionStore().$reset()
    usePaymentStore().$reset()
    useAttendanceStore().$reset()
    useUserStore().$reset()
    useConfigStore().$reset()
    useNotificationStore().$reset()
    useDashboardStore().$reset()
    useTournamentStore().$reset()
  }

  async function login(username: string, password: string): Promise<void> {
    resetOtherStores()
    loading.value = true
    try {
      user.value = await authApi.login(username, password)
    } finally {
      loading.value = false
    }
  }

  async function logout(): Promise<void> {
    resetOtherStores()
    try {
      await authApi.logout()
    } finally {
      user.value = null
    }
  }

  async function fetchMe(): Promise<void> {
    try {
      user.value = await authApi.getMe()
    } catch {
      user.value = null
    } finally {
      initialized.value = true
    }
  }

  // Called by the axios interceptor to clear session without an API call
  function clearSession(): void {
    resetOtherStores()
    user.value = null
  }

  return { user, loading, initialized, login, logout, fetchMe, clearSession }
})
