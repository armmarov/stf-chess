import apiClient from './client'

export type PollStatus = 'upcoming' | 'active' | 'expired'

export interface PollVoter {
  id: string
  name: string
  className: string | null
}

export interface PollOption {
  id: string
  label: string
  hasImage: boolean
  voteCount: number
  voters?: PollVoter[]
}

export interface PollListItem {
  id: string
  title: string
  description: string | null
  startDate: string
  endDate: string
  status: PollStatus
  totalVotes: number
  myVoted: boolean
}

export interface Poll extends PollListItem {
  options: PollOption[]
  myVotedOptionId: string | null
}

export interface CreatePollBody {
  title: string
  description?: string
  startDate: string
  endDate: string
  options: Array<{ label: string }>
}

export interface UpdatePollBody {
  title?: string
  description?: string | null
  startDate?: string
  endDate?: string
}

export function pollOptionImageUrl(pollId: string, optionId: string): string {
  const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api'
  const origin = new URL(base).origin
  return `${origin}/api/polls/${pollId}/options/${optionId}/image`
}

export async function listPolls(): Promise<PollListItem[]> {
  const { data } = await apiClient.get<{ polls: PollListItem[] }>('/polls')
  return data.polls
}

export async function getPoll(id: string): Promise<Poll> {
  const { data } = await apiClient.get<{ poll: Poll }>(`/polls/${id}`)
  return data.poll
}

export async function createPoll(
  body: CreatePollBody,
  imageFiles: Array<File | null>,
): Promise<Poll> {
  const form = new FormData()
  form.append('title', body.title)
  if (body.description) form.append('description', body.description)
  form.append('startDate', body.startDate)
  form.append('endDate', body.endDate)
  form.append('options', JSON.stringify(body.options))
  imageFiles.forEach((file, i) => {
    if (file) form.append(`option_${i}`, file)
  })
  const { data } = await apiClient.post<{ poll: Poll }>('/polls', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data.poll
}

export async function updatePoll(id: string, body: UpdatePollBody): Promise<Poll> {
  const { data } = await apiClient.patch<{ poll: Poll }>(`/polls/${id}`, body)
  return data.poll
}

export async function deletePoll(id: string): Promise<void> {
  await apiClient.delete(`/polls/${id}`)
}

export async function votePoll(
  id: string,
  optionId: string,
): Promise<{ optionId: string; poll: Poll }> {
  const { data } = await apiClient.post<{ optionId: string; poll: Poll }>(
    `/polls/${id}/vote`,
    { optionId },
  )
  return data
}
