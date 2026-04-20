<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { useSessionStore } from '@/stores/sessionStore'
import { useDashboardStore } from '@/stores/dashboardStore'
import { toDateString } from '@/utils/format'
import type { TeacherStats } from '@/api/dashboard'
import StatCard from '@/components/StatCard.vue'
import NotificationsCard from '@/components/NotificationsCard.vue'

const auth = useAuthStore()
const sessionStore = useSessionStore()
const dashboardStore = useDashboardStore()

const today = new Date().toISOString().slice(0, 10)

const todaysSessions = computed(() =>
  sessionStore.sessions.filter(
    (s) => toDateString(s.date) === today && !s.isCancelled,
  ),
)

const stats = computed(() => dashboardStore.stats as TeacherStats | null)

onMounted(() => {
  sessionStore.fetchSessions({ from: today, to: today })
  dashboardStore.fetchStats()
})
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <h1 class="text-lg font-semibold text-gray-900 mb-1">Teacher Dashboard</h1>
    <p class="text-sm text-gray-500 mb-4">Welcome, {{ auth.user?.name }}.</p>

    <!-- Overview stats -->
    <div class="grid grid-cols-2 gap-3 mb-4">
      <StatCard
        label="Sessions"
        :value="stats?.totalSessions ?? null"
        icon-name="calendar"
        variant="indigo"
      />
      <StatCard
        label="Students"
        :value="stats?.totalStudents ?? null"
        icon-name="users"
        variant="green"
      />
    </div>

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

    <div class="mt-4">
      <NotificationsCard />
    </div>
  </div>
</template>
