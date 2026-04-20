import apiClient from './client'

export interface InterestedStudent {
  id: string
  name: string
  className: string | null
}

export interface Tournament {
  id: string
  name: string
  description: string | null
  startDate: string
  endDate: string | null
  registrationLink: string | null
  hasImage: boolean
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
  registrationLink?: string
  image?: File
}

export interface UpdateTournamentBody {
  name?: string
  description?: string | null
  startDate?: string
  endDate?: string | null
  registrationLink?: string | null
  image?: File
  removeImage?: boolean
}

export function tournamentImageUrl(id: string): string {
  const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api'
  const origin = new URL(base).origin
  return `${origin}/api/tournaments/${id}/image`
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
  if (body.registrationLink) form.append('registrationLink', body.registrationLink)
  if (body.image) form.append('image', body.image)
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
  if (body.registrationLink !== undefined) form.append('registrationLink', body.registrationLink ?? '')
  if (body.image) form.append('image', body.image)
  if (body.removeImage) form.append('removeImage', 'true')
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
