import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as puzzleApi from '@/api/puzzles'
import type { TodayResponse, PuzzleStats } from '@/api/puzzles'

export const usePuzzleStore = defineStore('puzzle', () => {
  const today = ref<TodayResponse | null>(null)
  const stats = ref<PuzzleStats | null>(null)
  const loading = ref(false)

  const todayProgress = computed(() => {
    if (!today.value) return { solved: 0, total: 5 }
    const solved = today.value.puzzles.filter(p => p.myAttempts.solved).length
    return { solved, total: today.value.puzzles.length }
  })

  async function fetchToday() {
    loading.value = true
    try {
      today.value = await puzzleApi.getToday()
    } finally {
      loading.value = false
    }
  }

  async function fetchStats() {
    try {
      stats.value = await puzzleApi.getStats()
    } catch {
      // non-critical
    }
  }

  function $reset() {
    today.value = null
    stats.value = null
    loading.value = false
  }

  return { today, stats, loading, todayProgress, fetchToday, fetchStats, $reset }
})
