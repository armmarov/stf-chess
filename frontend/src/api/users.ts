import apiClient from './client'
import type { Role } from '@/stores/authStore'

export interface User {
  id: string
  name: string
  username: string
  role: Role
  phone: string | null
  isActive: boolean
  createdAt: string
}

export interface ListUsersQuery {
  role?: Role
  active?: boolean
}

export interface CreateUserBody {
  name: string
  username: string
  password: string
  role: Role
  phone?: string
}

export interface UpdateUserBody {
  name?: string
  phone?: string | null
  isActive?: boolean
}

export async function listUsers(query?: ListUsersQuery): Promise<User[]> {
  const params: Record<string, string> = {}
  if (query?.role) params.role = query.role
  if (query?.active !== undefined) params.active = String(query.active)
  const { data } = await apiClient.get<{ users: User[] }>('/users', { params })
  return data.users
}

export async function getUser(id: string): Promise<User> {
  const { data } = await apiClient.get<{ user: User }>(`/users/${id}`)
  return data.user
}

export async function createUser(body: CreateUserBody): Promise<User> {
  const { data } = await apiClient.post<{ user: User }>('/users', body)
  return data.user
}

export async function updateUser(id: string, patch: UpdateUserBody): Promise<User> {
  const { data } = await apiClient.patch<{ user: User }>(`/users/${id}`, patch)
  return data.user
}

export async function setPassword(id: string, newPassword: string): Promise<void> {
  await apiClient.post(`/users/${id}/password`, { newPassword })
}
