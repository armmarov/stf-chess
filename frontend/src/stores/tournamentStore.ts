import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as tournamentsApi from '@/api/tournaments'
import type { Tournament, CreateTournamentBody, UpdateTournamentBody } from '@/api/tournaments'

export type { Tournament }

export const useTournamentStore = defineStore('tournaments', () => {
  const list = ref<Tournament[]>([])
  const current = ref<Tournament | null>(null)
  const loading = ref(false)

  async function fetchList(): Promise<void> {
    loading.value = true
    try {
      list.value = await tournamentsApi.listTournaments()
    } finally {
      loading.value = false
    }
  }

  async function fetchTournament(id: string): Promise<void> {
    loading.value = true
    try {
      current.value = await tournamentsApi.getTournament(id)
    } finally {
      loading.value = false
    }
  }

  async function create(body: CreateTournamentBody): Promise<Tournament> {
    const t = await tournamentsApi.createTournament(body)
    list.value.unshift(t)
    return t
  }

  async function update(id: string, body: UpdateTournamentBody): Promise<Tournament> {
    const t = await tournamentsApi.updateTournament(id, body)
    const idx = list.value.findIndex((x) => x.id === id)
    if (idx !== -1) list.value[idx] = t
    if (current.value?.id === id) current.value = t
    return t
  }

  async function remove(id: string): Promise<void> {
    await tournamentsApi.deleteTournament(id)
    list.value = list.value.filter((x) => x.id !== id)
    if (current.value?.id === id) current.value = null
  }

  async function toggleInterest(id: string, confirmed: boolean): Promise<void> {
    const listItem = list.value.find((x) => x.id === id)
    const isCurrent = current.value?.id === id

    const oldInterested = listItem?.myInterested ?? current.value?.myInterested
    const oldCount = listItem?.interestCount ?? current.value?.interestCount ?? 0
    const newCount = confirmed ? oldCount + 1 : Math.max(0, oldCount - 1)

    if (listItem) { listItem.myInterested = confirmed; listItem.interestCount = newCount }
    if (isCurrent && current.value) { current.value.myInterested = confirmed; current.value.interestCount = newCount }

    try {
      const res = await tournamentsApi.setInterest(id, confirmed)
      if (listItem) { listItem.myInterested = res.interested; listItem.interestCount = res.interestCount }
      if (isCurrent && current.value) { current.value.myInterested = res.interested; current.value.interestCount = res.interestCount }
    } catch (e) {
      if (listItem) { listItem.myInterested = oldInterested; listItem.interestCount = oldCount }
      if (isCurrent && current.value) { current.value.myInterested = oldInterested; current.value.interestCount = oldCount }
      throw e
    }
  }

  function $reset() {
    list.value = []
    current.value = null
    loading.value = false
  }

  return { list, current, loading, fetchList, fetchTournament, create, update, remove, toggleInterest, $reset }
})
