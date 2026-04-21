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
  hasImage: boolean
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
  image?: File | null
}

export type UpdateRecordBody = Partial<Omit<CreateRecordBody, 'studentId'>> & {
  removeImage?: boolean
}

function toFormData(body: Record<string, unknown>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(body)) {
    if (v === undefined) continue
    if (k === 'image') {
      if (v instanceof File) fd.append('image', v)
      continue
    }
    if (v === null) {
      fd.append(k, '')
    } else if (typeof v === 'boolean') {
      fd.append(k, v ? 'true' : 'false')
    } else {
      fd.append(k, String(v))
    }
  }
  return fd
}

export async function listRecords(opts?: { studentId?: string }): Promise<CompetitionRecord[]> {
  const params: Record<string, string> = {}
  if (opts?.studentId) params.studentId = opts.studentId
  const { data } = await apiClient.get<{ records: CompetitionRecord[] }>('/records', { params })
  return data.records
}

export async function getRecord(id: string): Promise<CompetitionRecord> {
  const { data } = await apiClient.get<{ record: CompetitionRecord }>(`/records/${id}`)
  return data.record
}

export async function createRecord(body: CreateRecordBody): Promise<CompetitionRecord> {
  const fd = toFormData(body as unknown as Record<string, unknown>)
  const { data } = await apiClient.post<{ record: CompetitionRecord }>('/records', fd)
  return data.record
}

export async function updateRecord(id: string, patch: UpdateRecordBody): Promise<CompetitionRecord> {
  const fd = toFormData(patch as unknown as Record<string, unknown>)
  const { data } = await apiClient.patch<{ record: CompetitionRecord }>(`/records/${id}`, fd)
  return data.record
}

export async function deleteRecord(id: string): Promise<void> {
  await apiClient.delete(`/records/${id}`)
}

export function recordImageUrl(id: string): string {
  return `/api/records/${id}/image`
}
