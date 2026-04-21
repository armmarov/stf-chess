import apiClient from './client'

export interface PuzzleMyAttempts {
  solved: boolean
  attempts: number
  bestTimeMs: number | null
}

export interface PuzzleSummary {
  id: string
  externalId: string
  fen: string
  solutionLength: number
  rating: number
  themes: string[]
  gameUrl: string | null
  myAttempts: PuzzleMyAttempts
}

export interface TodayResponse {
  date: string
  puzzles: PuzzleSummary[]   // 5 items, rating ASC
}

export interface CheckMoveResult {
  correct: boolean
  replyUci?: string
  solved?: boolean
  expected?: string
}

export interface AttemptBody {
  status: 'solved' | 'failed' | 'gave_up'
  movesTaken: number
  timeMs: number
}

export interface AttemptResult {
  attempt: {
    id: string
    status: string
    isFirstTry: boolean
    movesTaken: number
    timeMs: number
    attemptedOn: string
  }
  /** Included when status is 'gave_up' so the FE can replay the solution. */
  solutionUci?: string[]
}

export interface PuzzleStats {
  totalSolved: number
  currentStreak: number
  longestStreak: number
  todayProgress: { solved: number; total: number }
  last7Days: Array<{ date: string; solved: number }>
}

export async function getToday(): Promise<TodayResponse> {
  const { data } = await apiClient.get<TodayResponse>('/puzzles/today')
  return data
}

export async function checkMove(
  id: string,
  body: { ply: number; uci: string },
): Promise<CheckMoveResult> {
  const { data } = await apiClient.post<CheckMoveResult>(`/puzzles/${id}/check-move`, body)
  return data
}

export async function postAttempt(id: string, body: AttemptBody): Promise<AttemptResult> {
  const { data } = await apiClient.post<AttemptResult>(`/puzzles/${id}/attempt`, body)
  return data
}

export async function getStats(): Promise<PuzzleStats> {
  const { data } = await apiClient.get<PuzzleStats>('/puzzles/me/stats')
  return data
}
