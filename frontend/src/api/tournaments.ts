import apiClient from './client'

export interface InterestedStudent {
  id: string
  name: string
  className: string | null
}

export type PajskTarget = 'tiada' | 'sekolah' | 'daerah' | 'negeri' | 'kebangsaan' | 'antarabangsa'

export interface Tournament {
  id: string
  name: string
  description: string | null
  startDate: string
  endDate: string | null
  registrationLink: string | null
  resultUrl: string | null
  place: string | null
  targetPajsk: PajskTarget
  hasImage: boolean
  hasBskkLetter: boolean
  hasKpmLetter: boolean
  interestCount: number
  myInterested?: boolean
  // Only present in GET /tournaments/:id (detail)
  interestedStudents?: InterestedStudent[]
  createdBy?: { id: string; name: string }
  createdAt: string
  updatedAt: string
}

export interface CreateTournamentBody {
  name: string
  description?: string
  startDate: string
  endDate?: string
  place?: string
  registrationLink?: string
  resultUrl?: string
  targetPajsk?: PajskTarget
  image?: File
  bskkLetter?: File
  kpmLetter?: File
}

export interface UpdateTournamentBody {
  name?: string
  description?: string | null
  startDate?: string
  endDate?: string | null
  place?: string | null
  registrationLink?: string | null
  resultUrl?: string | null
  targetPajsk?: PajskTarget
  image?: File
  bskkLetter?: File
  kpmLetter?: File
  removeImage?: boolean
  removeBskkLetter?: boolean
  removeKpmLetter?: boolean
}

function apiOrigin(): string {
  const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api'
  return new URL(base).origin
}

export function tournamentImageUrl(id: string): string {
  return `${apiOrigin()}/api/tournaments/${id}/image`
}

export function tournamentLetterUrl(id: string, which: 'bskk' | 'kpm'): string {
  return `${apiOrigin()}/api/tournaments/${id}/letter/${which}`
}

export async function listTournaments(): Promise<Tournament[]> {
  const { data } = await apiClient.get<{ tournaments: Tournament[] }>('/tournaments')
  return data.tournaments
}

export async function getTournament(id: string): Promise<Tournament> {
  const { data } = await apiClient.get<{ tournament: Tournament }>(`/tournaments/${id}`)
  return data.tournament
}

export async function createTournament(body: CreateTournamentBody): Promise<Tournament> {
  const form = new FormData()
  form.append('name', body.name)
  if (body.description) form.append('description', body.description)
  form.append('startDate', body.startDate)
  if (body.endDate) form.append('endDate', body.endDate)
  if (body.place) form.append('place', body.place)
  if (body.registrationLink) form.append('registrationLink', body.registrationLink)
  if (body.resultUrl) form.append('resultUrl', body.resultUrl)
  if (body.targetPajsk) form.append('targetPajsk', body.targetPajsk)
  if (body.image) form.append('image', body.image)
  if (body.bskkLetter) form.append('bskkLetter', body.bskkLetter)
  if (body.kpmLetter) form.append('kpmLetter', body.kpmLetter)
  const { data } = await apiClient.post<{ tournament: Tournament }>('/tournaments', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data.tournament
}

export async function updateTournament(id: string, body: UpdateTournamentBody): Promise<Tournament> {
  const form = new FormData()
  if (body.name !== undefined) form.append('name', body.name)
  if (body.description !== undefined) form.append('description', body.description ?? '')
  if (body.startDate !== undefined) form.append('startDate', body.startDate)
  if (body.endDate !== undefined) form.append('endDate', body.endDate ?? '')
  if (body.place !== undefined) form.append('place', body.place ?? '')
  if (body.registrationLink !== undefined) form.append('registrationLink', body.registrationLink ?? '')
  if (body.resultUrl !== undefined) form.append('resultUrl', body.resultUrl ?? '')
  if (body.targetPajsk !== undefined) form.append('targetPajsk', body.targetPajsk)
  if (body.image) form.append('image', body.image)
  if (body.bskkLetter) form.append('bskkLetter', body.bskkLetter)
  if (body.kpmLetter) form.append('kpmLetter', body.kpmLetter)
  if (body.removeImage) form.append('removeImage', 'true')
  if (body.removeBskkLetter) form.append('removeBskkLetter', 'true')
  if (body.removeKpmLetter) form.append('removeKpmLetter', 'true')
  const { data } = await apiClient.patch<{ tournament: Tournament }>(`/tournaments/${id}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data.tournament
}

export async function deleteTournament(id: string): Promise<void> {
  await apiClient.delete(`/tournaments/${id}`)
}

export async function setInterest(
  id: string,
  interested: boolean,
): Promise<{ interested: boolean; interestCount: number }> {
  const { data } = await apiClient.post<{ interested: boolean; interestCount: number }>(
    `/tournaments/${id}/interest`,
    { interested },
  )
  return data
}
