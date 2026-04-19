import apiClient from './client'
import type { AuthUser } from '@/stores/authStore'

export async function login(username: string, password: string): Promise<AuthUser> {
  const { data } = await apiClient.post<{ user: AuthUser }>('/auth/login', { username, password })
  return data.user
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout')
}

export async function getMe(): Promise<AuthUser> {
  const { data } = await apiClient.get<{ user: AuthUser }>('/auth/me')
  return data.user
}
