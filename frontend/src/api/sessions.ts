import apiClient from './client'

export interface SessionCount {
  preAttendances: number
}

export interface SessionUser {
  id: string
  name: string
}

// Shape returned by GET /sessions (list)
export interface SessionListItem {
  id: string
  date: string // ISO datetime (extract YYYY-MM-DD for display)
  startTime: string // ISO datetime (extract HH:MM for display)
  endTime: string // ISO datetime (extract HH:MM for display)
  place: string
  notes: string | null
  isCancelled: boolean
  cancelledAt: string | null
  createdAt: string
  createdById: string
  cancelledById: string | null
  _count: SessionCount
  // Included by BE when requester is a student — undefined otherwise
  myPreAttended?: boolean
}

// Shape returned by GET /sessions/:id, POST, PATCH (includes relations)
export interface Session extends SessionListItem {
  createdBy: SessionUser
  cancelledBy: SessionUser | null
}

export interface ListSessionsQuery {
  from?: string
  to?: string
  includeCancelled?: boolean
}

export interface CreateSessionBody {
  date: string      // YYYY-MM-DD
  startTime: string // HH:MM
  endTime: string   // HH:MM
  place: string
  notes?: string
}

export interface UpdateSessionBody {
  date?: string
  startTime?: string
  endTime?: string
  place?: string
  notes?: string | null
  isCancelled?: boolean
}

export async function listSessions(query?: ListSessionsQuery): Promise<SessionListItem[]> {
  const params: Record<string, string> = {}
  if (query?.from) params.from = query.from
  if (query?.to) params.to = query.to
  if (query?.includeCancelled !== undefined) params.includeCancelled = String(query.includeCancelled)
  const { data } = await apiClient.get<{ sessions: SessionListItem[] }>('/sessions', { params })
  return data.sessions
}

export async function getSession(id: string): Promise<Session> {
  const { data } = await apiClient.get<{ session: Session }>(`/sessions/${id}`)
  return data.session
}

export async function createSession(body: CreateSessionBody): Promise<Session> {
  const { data } = await apiClient.post<{ session: Session }>('/sessions', body)
  return data.session
}

export async function updateSession(id: string, body: UpdateSessionBody): Promise<Session> {
  const { data } = await apiClient.patch<{ session: Session }>(`/sessions/${id}`, body)
  return data.session
}
