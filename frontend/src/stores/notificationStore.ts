import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as notifApi from '@/api/notifications'
import type { Notification } from '@/api/notifications'
import { useToastStore } from './toastStore'

export const useNotificationStore = defineStore('notifications', () => {
  const items = ref<Notification[]>([])
  const unreadCount = ref(0)
  const loading = ref(false)
  const lastFetchedAt = ref<Date | null>(null)

  async function fetchNotifications(params?: { limit?: number; unreadOnly?: boolean }) {
    loading.value = true
    try {
      items.value = await notifApi.listNotifications(params)
      lastFetchedAt.value = new Date()
    } finally {
      loading.value = false
    }
  }

  async function fetchUnreadCount() {
    const data = await notifApi.getUnreadCount()
    unreadCount.value = data.count
  }

  async function markRead(id: string) {
    const item = items.value.find((n) => n.id === id)
    if (!item || item.readAt) return

    // Optimistic update
    item.readAt = new Date().toISOString()
    unreadCount.value = Math.max(0, unreadCount.value - 1)

    try {
      await notifApi.markRead(id)
    } catch {
      // Revert
      item.readAt = null
      unreadCount.value += 1
      useToastStore().show('Failed to mark as read.', 'error')
    }
  }

  async function markAllRead() {
    await notifApi.markAllRead()
    const now = new Date().toISOString()
    items.value.forEach((n) => {
      if (!n.readAt) n.readAt = now
    })
    unreadCount.value = 0
  }

  function $reset() {
    items.value = []
    unreadCount.value = 0
    loading.value = false
    lastFetchedAt.value = null
  }

  return {
    items,
    unreadCount,
    loading,
    lastFetchedAt,
    fetchNotifications,
    fetchUnreadCount,
    markRead,
    markAllRead,
    $reset,
  }
})
