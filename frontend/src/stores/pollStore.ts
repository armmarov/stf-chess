import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as pollsApi from '@/api/polls'
import type { Poll, PollListItem } from '@/api/polls'

export type { Poll, PollListItem }

export const usePollStore = defineStore('polls', () => {
  const list = ref<PollListItem[]>([])
  const current = ref<Poll | null>(null)
  const loading = ref(false)

  async function fetchList(): Promise<void> {
    loading.value = true
    try {
      list.value = await pollsApi.listPolls()
    } finally {
      loading.value = false
    }
  }

  async function fetchPoll(id: string): Promise<void> {
    loading.value = true
    try {
      current.value = await pollsApi.getPoll(id)
    } finally {
      loading.value = false
    }
  }

  async function create(
    body: pollsApi.CreatePollBody,
    imageFiles: Array<File | null>,
  ): Promise<Poll> {
    const poll = await pollsApi.createPoll(body, imageFiles)
    list.value.unshift({
      id: poll.id,
      title: poll.title,
      description: poll.description,
      startDate: poll.startDate,
      endDate: poll.endDate,
      status: poll.status,
      totalVotes: 0,
      myVoted: false,
    })
    return poll
  }

  async function update(id: string, body: pollsApi.UpdatePollBody): Promise<Poll> {
    const poll = await pollsApi.updatePoll(id, body)
    const idx = list.value.findIndex((p) => p.id === id)
    if (idx !== -1) {
      list.value[idx] = {
        id: poll.id,
        title: poll.title,
        description: poll.description,
        startDate: poll.startDate,
        endDate: poll.endDate,
        status: poll.status,
        totalVotes: poll.totalVotes,
        myVoted: poll.myVoted,
      }
    }
    if (current.value?.id === id) current.value = poll
    return poll
  }

  async function remove(id: string): Promise<void> {
    await pollsApi.deletePoll(id)
    list.value = list.value.filter((p) => p.id !== id)
    if (current.value?.id === id) current.value = null
  }

  async function vote(id: string, optionId: string): Promise<Poll> {
    const result = await pollsApi.votePoll(id, optionId)
    current.value = result.poll
    const idx = list.value.findIndex((p) => p.id === id)
    if (idx !== -1) {
      list.value[idx] = {
        ...list.value[idx],
        myVoted: true,
        totalVotes: result.poll.totalVotes,
        status: result.poll.status,
      }
    }
    return result.poll
  }

  function $reset() {
    list.value = []
    current.value = null
    loading.value = false
  }

  return { list, current, loading, fetchList, fetchPoll, create, update, remove, vote, $reset }
})
