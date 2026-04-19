<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { useSessionStore } from '@/stores/sessionStore'
import { toDateString } from '@/utils/format'

const auth = useAuthStore()
const sessionStore = useSessionStore()

const today = new Date().toISOString().slice(0, 10)

const todaysSessions = computed(() =>
  sessionStore.sessions.filter(
    (s) => toDateString(s.date) === today && !s.isCancelled,
  ),
)

onMounted(() => sessionStore.fetchSessions({ from: today, to: today }))
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <h1 class="text-lg font-semibold text-gray-900 mb-1">Teacher Dashboard</h1>
    <p class="text-sm text-gray-500 mb-6">Welcome, {{ auth.user?.name }}.</p>

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <!-- Today's attendance quick-links -->
      <template v-if="todaysSessions.length > 0">
        <RouterLink
          v-for="s in todaysSessions"
          :key="s.id"
          :to="`/sessions/${s.id}/attendance`"
          class="flex flex-col gap-1 rounded-lg border border-indigo-200 bg-indigo-50 p-4 hover:border-indigo-400 transition-colors"
        >
          <span class="font-medium text-indigo-900 text-sm">Mark Today's Attendance</span>
          <span class="text-xs text-indigo-700">{{ s.place }}</span>
        </RouterLink>
      </template>

      <RouterLink
        to="/sessions"
        class="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-4 hover:border-indigo-300 transition-colors"
      >
        <span class="font-medium text-gray-900 text-sm">Sessions</span>
        <span class="text-xs text-gray-500">View and manage coaching sessions</span>
      </RouterLink>
      <RouterLink
        to="/teacher/students"
        class="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-4 hover:border-indigo-300 transition-colors"
      >
        <span class="font-medium text-gray-900 text-sm">Students</span>
        <span class="text-xs text-gray-500">View and manage your students</span>
      </RouterLink>
      <RouterLink
        to="/payments/review"
        class="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-4 hover:border-indigo-300 transition-colors"
      >
        <span class="font-medium text-gray-900 text-sm">Payment Review</span>
        <span class="text-xs text-gray-500">Approve or reject student payment receipts</span>
      </RouterLink>
    </div>
  </div>
</template>
