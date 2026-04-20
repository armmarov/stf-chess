<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { useDashboardStore } from '@/stores/dashboardStore'
import type { StudentStats } from '@/api/dashboard'
import StatCard from '@/components/StatCard.vue'
import NotificationsCard from '@/components/NotificationsCard.vue'

const auth = useAuthStore()
const dashboardStore = useDashboardStore()

const stats = computed(() => dashboardStore.stats as StudentStats | null)

onMounted(() => dashboardStore.fetchStats())
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

    <div class="mt-4">
      <NotificationsCard />
    </div>
  </div>
</template>
