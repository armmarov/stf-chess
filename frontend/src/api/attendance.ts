import apiClient from './client'

export interface PreAttendanceRecord {
  sessionId: string
  studentId: string
  confirmedAt: string
}

export interface PreAttendanceResponse {
  preAttendance: PreAttendanceRecord | null
}

export interface RosterStudent {
  id: string
  name: string
  username: string
  className: string | null
}

export interface RosterEntry {
  student: RosterStudent
  preAttended: boolean
  present: boolean
  paidCash: boolean
  onlinePaymentStatus: 'pending' | 'approved' | 'rejected' | null
}

export interface RosterSession {
  id: string
  date: string
  startTime: string
  endTime: string
  place: string
  isCancelled: boolean
}

export interface AttendanceRoster {
  session: RosterSession
  roster: RosterEntry[]
}

export interface MarkEntry {
  studentId: string
  present: boolean
  paidCash: boolean
}

export async function setPreAttendance(
  sessionId: string,
  confirmed: boolean,
  studentId?: string,
): Promise<PreAttendanceResponse> {
  const body: { confirmed: boolean; studentId?: string } = { confirmed }
  if (studentId) body.studentId = studentId
  const { data } = await apiClient.post<PreAttendanceResponse>(
    `/sessions/${sessionId}/pre-attendance`,
    body,
  )
  return data
}

export async function getRoster(sessionId: string): Promise<AttendanceRoster> {
  const { data } = await apiClient.get<AttendanceRoster>(`/sessions/${sessionId}/attendance`)
  return data
}

export async function markAttendance(
  sessionId: string,
  entries: MarkEntry[],
): Promise<{ updated: number }> {
  const { data } = await apiClient.put<{ updated: number }>(
    `/sessions/${sessionId}/attendance`,
    { entries },
  )
  return data
}
