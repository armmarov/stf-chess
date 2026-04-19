<script setup lang="ts">
import { useAuthStore } from '@/stores/authStore'

const auth = useAuthStore()
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <h1 class="text-lg font-semibold text-gray-900 mb-1">Student Dashboard</h1>
    <p class="text-sm text-gray-500 mb-6">Welcome, {{ auth.user?.name }}.</p>

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <RouterLink
        to="/sessions"
        class="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-4 hover:border-indigo-300 transition-colors"
      >
        <span class="font-medium text-gray-900 text-sm">Upcoming Sessions</span>
        <span class="text-xs text-gray-500">View sessions and confirm your attendance</span>
      </RouterLink>
      <RouterLink
        to="/student/payments"
        class="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-4 hover:border-indigo-300 transition-colors"
      >
        <span class="font-medium text-gray-900 text-sm">Payments</span>
        <span class="text-xs text-gray-500">Upload receipts and track payment status</span>
      </RouterLink>
    </div>
  </div>
</template>
