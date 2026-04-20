import api from '@/api/client'

export interface Notification {
  id: string
  type: string
  title: string
  message: string
  linkPath: string | null
  payload: unknown
  readAt: string | null
  createdAt: string
}

export function listNotifications(params?: { limit?: number; unreadOnly?: boolean }) {
  const { limit, unreadOnly } = params ?? {}
  return api
    .get<{ notifications: Notification[] }>('/notifications', {
      params: { limit, unread: unreadOnly },
    })
    .then((r) => r.data.notifications)
}

export function getUnreadCount() {
  return api.get<{ count: number }>('/notifications/unread-count').then((r) => r.data)
}

export function markRead(id: string) {
  return api.post(`/notifications/${id}/read`).then((r) => r.data)
}

export function markAllRead() {
  return api.post('/notifications/read-all').then((r) => r.data)
}
