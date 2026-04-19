import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as usersApi from '@/api/users'
import type { User, ListUsersQuery, CreateUserBody, UpdateUserBody } from '@/api/users'

export type { User }

export const useUserStore = defineStore('users', () => {
  // Cache keyed by serialised query so different role/active combos don't stomp each other
  const listCache = ref<Record<string, User[]>>({})
  const current = ref<User | null>(null)
  const loading = ref(false)

  function cacheKey(query?: ListUsersQuery) {
    return `${query?.role ?? 'all'}_${query?.active ?? 'all'}`
  }

  async function fetchUsers(query?: ListUsersQuery): Promise<void> {
    loading.value = true
    try {
      const users = await usersApi.listUsers(query)
      listCache.value[cacheKey(query)] = users
    } finally {
      loading.value = false
    }
  }

  async function fetchUser(id: string): Promise<void> {
    loading.value = true
    try {
      current.value = await usersApi.getUser(id)
    } finally {
      loading.value = false
    }
  }

  async function createUser(body: CreateUserBody): Promise<User> {
    const user = await usersApi.createUser(body)
    // Invalidate list cache
    listCache.value = {}
    return user
  }

  async function updateUser(id: string, patch: UpdateUserBody): Promise<User> {
    const user = await usersApi.updateUser(id, patch)
    if (current.value?.id === id) current.value = user
    // Update in any cached lists
    for (const key of Object.keys(listCache.value)) {
      const idx = listCache.value[key].findIndex((u) => u.id === id)
      if (idx !== -1) listCache.value[key][idx] = user
    }
    return user
  }

  async function setPassword(id: string, newPassword: string): Promise<void> {
    await usersApi.setPassword(id, newPassword)
  }

  return { listCache, current, loading, cacheKey, fetchUsers, fetchUser, createUser, updateUser, setPassword }
})
