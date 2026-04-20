import api from '@/api/client'

export interface StudentStats {
  totalSessions: number
  sessionsJoined: number
  pendingPayments: number
}

export interface TeacherStats {
  totalSessions: number
  totalStudents: number
}

export interface AdminStats {
  totalSessions: number
  totalStudents: number
  totalTeachers: number
}

export type DashboardStats = StudentStats | TeacherStats | AdminStats

export async function getStats(): Promise<DashboardStats> {
  const { data } = await api.get<{ stats: DashboardStats }>('/dashboard/stats')
  return data.stats
}
