import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as attendanceApi from '@/api/attendance'
import type { AttendanceRoster, MarkEntry } from '@/api/attendance'

export type { AttendanceRoster, MarkEntry }

export const useAttendanceStore = defineStore('attendance', () => {
  const rosterBySession = ref<Record<string, AttendanceRoster>>({})
  // Tracks pre-attendance state for current user (populated on toggle)
  const preAttendanceBySession = ref<Record<string, boolean>>({})
  const loading = ref(false)

  async function fetchRoster(sessionId: string): Promise<void> {
    loading.value = true
    try {
      rosterBySession.value[sessionId] = await attendanceApi.getRoster(sessionId)
    } finally {
      loading.value = false
    }
  }

  async function saveRoster(sessionId: string, entries: MarkEntry[]): Promise<{ updated: number }> {
    return attendanceApi.markAttendance(sessionId, entries)
  }

  async function togglePreAttendance(sessionId: string, confirmed: boolean): Promise<void> {
    // Optimistic update
    const previous = preAttendanceBySession.value[sessionId] ?? false
    preAttendanceBySession.value[sessionId] = confirmed
    try {
      await attendanceApi.setPreAttendance(sessionId, confirmed)
    } catch (err) {
      // Revert on error
      preAttendanceBySession.value[sessionId] = previous
      throw err
    }
  }

  function $reset() {
    rosterBySession.value = {}
    preAttendanceBySession.value = {}
    loading.value = false
  }

  return { rosterBySession, preAttendanceBySession, loading, fetchRoster, saveRoster, togglePreAttendance, $reset }
})
