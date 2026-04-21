import apiClient from './client'

export type GameResult = 'white_win' | 'black_win' | 'draw'

export interface GameListItem {
  id: string
  tournamentName: string | null
  whitePlayer: string
  blackPlayer: string
  result: GameResult
  eventDate: string | null
  whiteElo: number | null
  blackElo: number | null
  opening: string | null
  createdAt: string
}

export interface Game extends GameListItem {
  pgn: string | null
  notes: string | null
}

export interface ListGamesParams {
  tournamentName?: string
  player?: string
}

export interface CreateGameBody {
  tournamentName?: string
  whitePlayer: string
  blackPlayer: string
  result: GameResult
  eventDate?: string
  whiteElo?: number
  blackElo?: number
  opening?: string
  notes?: string
  pgn?: string
}

export type UpdateGameBody = Partial<CreateGameBody>

export const RESULT_DISPLAY: Record<GameResult, string> = {
  white_win: '1-0',
  black_win: '0-1',
  draw: '½-½',
}

export const RESULT_COLORS: Record<GameResult, string> = {
  white_win: 'bg-gray-100 text-gray-800',
  black_win: 'bg-gray-800 text-white',
  draw: 'bg-yellow-100 text-yellow-800',
}

export async function listGames(params?: ListGamesParams): Promise<GameListItem[]> {
  const { data } = await apiClient.get<{ games: GameListItem[] }>('/games', { params })
  return data.games
}

export async function getGame(id: string): Promise<Game> {
  const { data } = await apiClient.get<{ game: Game }>(`/games/${id}`)
  return data.game
}

export async function createGame(body: CreateGameBody): Promise<Game> {
  const { data } = await apiClient.post<{ game: Game }>('/games', body)
  return data.game
}

export async function updateGame(id: string, body: UpdateGameBody): Promise<Game> {
  const { data } = await apiClient.patch<{ game: Game }>(`/games/${id}`, body)
  return data.game
}

export async function deleteGame(id: string): Promise<void> {
  await apiClient.delete(`/games/${id}`)
}
