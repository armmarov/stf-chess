<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { useDashboardStore } from '@/stores/dashboardStore'
import { useSessionStore } from '@/stores/sessionStore'
import type { StudentStats } from '@/api/dashboard'
import { toHHMM, formatDate } from '@/utils/format'
import StatCard from '@/components/StatCard.vue'
import NotificationsCard from '@/components/NotificationsCard.vue'
import AppIcon from '@/components/AppIcon.vue'
import PuzzleDashboardCard from '@/components/PuzzleDashboardCard.vue'

const auth = useAuthStore()
const dashboardStore = useDashboardStore()
const sessionStore = useSessionStore()
const router = useRouter()

const stats = computed(() => dashboardStore.stats as StudentStats | null)

const nextSession = computed(() => {
  const now = new Date()
  return sessionStore.sessions
    .filter((s) => !s.isCancelled && new Date(s.startTime) >= now)
    .sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date)
      return dateCmp !== 0 ? dateCmp : a.startTime.localeCompare(b.startTime)
    })[0] ?? null
})

onMounted(() => {
  dashboardStore.fetchStats()
  const today = new Date().toISOString().slice(0, 10)
  sessionStore.fetchSessions({ from: today, includeCancelled: false })
})
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <h1 class="text-lg font-semibold text-gray-900 mb-1">Student Dashboard</h1>
    <p class="text-sm text-gray-500 mb-4">Welcome, {{ auth.user?.name }}.</p>

    <!-- Overview stats -->
    <div class="grid grid-cols-2 gap-3 mb-4">
      <StatCard
        label="Attended"
        :value="stats ? `${stats.sessionsJoined}/${stats.totalSessions}` : null"
        icon-name="check-circle"
        variant="green"
      />
      <StatCard
        label="Pending Payments"
        :value="stats?.pendingPayments ?? null"
        icon-name="clock"
        variant="yellow"
      />
    </div>

    <!-- Next session card -->
    <div
      v-if="nextSession"
      class="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-4 cursor-pointer hover:border-indigo-400 transition-colors"
      @click="router.push(`/sessions/${nextSession.id}`)"
    >
      <div class="flex items-start justify-between gap-2">
        <div class="flex flex-col gap-1">
          <p class="text-xs font-medium text-indigo-500 uppercase tracking-wide mb-0.5">Next session</p>
          <p class="text-sm font-medium text-gray-900 flex items-center gap-1.5">
            <AppIcon name="calendar" class="h-3.5 w-3.5 text-indigo-400 shrink-0" />
            {{ formatDate(nextSession.date) }}
          </p>
          <p class="text-sm text-gray-600 flex items-center gap-1.5">
            <AppIcon name="clock" class="h-3.5 w-3.5 text-gray-400 shrink-0" />
            {{ toHHMM(nextSession.startTime) }} – {{ toHHMM(nextSession.endTime) }}
          </p>
          <p class="text-sm text-gray-600 flex items-center gap-1.5">
            <AppIcon name="map-pin" class="h-3.5 w-3.5 text-gray-400 shrink-0" />
            {{ nextSession.place }}
          </p>
        </div>
        <span
          v-if="nextSession.myPreAttended"
          class="inline-block rounded-full bg-green-100 text-green-700 text-xs px-2 py-0.5 font-medium shrink-0 mt-0.5"
        >
          Pre-attended
        </span>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <RouterLink
        to="/sessions"
        class="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-4 hover:border-indigo-300 transition-colors"
      >
        <span class="font-medium text-gray-900 text-sm">Coaching Sessions</span>
        <span class="text-xs text-gray-500">View sessions and confirm your attendance</span>
      </RouterLink>
      <RouterLink
        to="/student/payments"
        class="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-4 hover:border-indigo-300 transition-colors"
      >
        <span class="font-medium text-gray-900 text-sm">Payments</span>
        <span class="text-xs text-gray-500">View your payment history</span>
      </RouterLink>
    </div>

    <div class="mt-4 flex flex-col gap-3">
      <PuzzleDashboardCard />
      <NotificationsCard />
    </div>
  </div>
</template>
