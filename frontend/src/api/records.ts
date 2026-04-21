import apiClient from './client'

export type RecordLevel = 'sekolah' | 'daerah' | 'negeri' | 'kebangsaan' | 'antarabangsa'
export type RecordCategory = 'u13' | 'u14' | 'u15' | 'u16' | 'u17' | 'u18' | 'u21' | 'open'

export interface CompetitionRecord {
  id: string
  competitionName: string
  competitionDate: string
  level: RecordLevel
  category: RecordCategory
  pajsk: boolean
  fideRated: boolean
  mcfRated: boolean
  placement: number | null
  createdAt: string
  updatedAt: string
  student: { id: string; name: string; username: string; className: string | null }
  createdBy: { id: string; name: string }
}

export interface CreateRecordBody {
  studentId: string
  competitionName: string
  competitionDate: string
  level: RecordLevel
  category: RecordCategory
  pajsk: boolean
  fideRated: boolean
  mcfRated: boolean
  placement: number | null
}

export type UpdateRecordBody = Partial<Omit<CreateRecordBody, 'studentId'>>

export async function listRecords(opts?: { studentId?: string }): Promise<CompetitionRecord[]> {
  const params: Record<string, string> = {}
  if (opts?.studentId) params.studentId = opts.studentId
  const { data } = await apiClient.get<CompetitionRecord[]>('/records', { params })
  return data
}

export async function getRecord(id: string): Promise<CompetitionRecord> {
  const { data } = await apiClient.get<CompetitionRecord>(`/records/${id}`)
  return data
}

export async function createRecord(body: CreateRecordBody): Promise<CompetitionRecord> {
  const { data } = await apiClient.post<CompetitionRecord>('/records', body)
  return data
}

export async function updateRecord(id: string, patch: UpdateRecordBody): Promise<CompetitionRecord> {
  const { data } = await apiClient.patch<CompetitionRecord>(`/records/${id}`, patch)
  return data
}

export async function deleteRecord(id: string): Promise<void> {
  await apiClient.delete(`/records/${id}`)
}
