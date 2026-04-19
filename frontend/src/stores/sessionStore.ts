import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as sessionsApi from '@/api/sessions'
import type {
  Session,
  SessionListItem,
  ListSessionsQuery,
  CreateSessionBody,
  UpdateSessionBody,
} from '@/api/sessions'

export type { Session, SessionListItem }

export const useSessionStore = defineStore('sessions', () => {
  const sessions = ref<SessionListItem[]>([])
  const current = ref<Session | null>(null)
  const loading = ref(false)

  async function fetchSessions(query?: ListSessionsQuery): Promise<void> {
    loading.value = true
    try {
      sessions.value = await sessionsApi.listSessions(query)
    } finally {
      loading.value = false
    }
  }

  async function fetchSession(id: string): Promise<void> {
    loading.value = true
    try {
      current.value = await sessionsApi.getSession(id)
    } finally {
      loading.value = false
    }
  }

  async function createSession(body: CreateSessionBody): Promise<Session> {
    const session = await sessionsApi.createSession(body)
    // Optimistically insert into list as a SessionListItem (cast is safe — Session extends it)
    sessions.value.unshift(session)
    return session
  }

  async function updateSession(id: string, body: UpdateSessionBody): Promise<Session> {
    const session = await sessionsApi.updateSession(id, body)
    const idx = sessions.value.findIndex((s) => s.id === id)
    if (idx !== -1) sessions.value[idx] = session
    if (current.value?.id === id) current.value = session
    return session
  }

  async function cancelSession(id: string): Promise<Session> {
    return updateSession(id, { isCancelled: true })
  }

  return { sessions, current, loading, fetchSessions, fetchSession, createSession, updateSession, cancelSession }
})
