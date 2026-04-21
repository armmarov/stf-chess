import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as gamesApi from '@/api/games'
import type { Game, GameListItem, ListGamesParams } from '@/api/games'

export type { Game, GameListItem }

export const useGameStore = defineStore('games', () => {
  const list = ref<GameListItem[]>([])
  const current = ref<Game | null>(null)
  const loading = ref(false)

  async function fetchList(params?: ListGamesParams): Promise<void> {
    loading.value = true
    try {
      list.value = await gamesApi.listGames(params)
    } finally {
      loading.value = false
    }
  }

  async function fetchGame(id: string): Promise<void> {
    loading.value = true
    try {
      current.value = await gamesApi.getGame(id)
    } finally {
      loading.value = false
    }
  }

  async function create(body: gamesApi.CreateGameBody): Promise<Game> {
    const game = await gamesApi.createGame(body)
    list.value.unshift(game)
    return game
  }

  async function update(id: string, body: gamesApi.UpdateGameBody): Promise<Game> {
    const game = await gamesApi.updateGame(id, body)
    const idx = list.value.findIndex((g) => g.id === id)
    if (idx !== -1) list.value[idx] = game
    if (current.value?.id === id) current.value = game
    return game
  }

  async function remove(id: string): Promise<void> {
    await gamesApi.deleteGame(id)
    list.value = list.value.filter((g) => g.id !== id)
    if (current.value?.id === id) current.value = null
  }

  function $reset() {
    list.value = []
    current.value = null
    loading.value = false
  }

  return { list, current, loading, fetchList, fetchGame, create, update, remove, $reset }
})
