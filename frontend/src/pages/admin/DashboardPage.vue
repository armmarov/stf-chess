<script setup lang="ts">
import { useAuthStore } from '@/stores/authStore'

const auth = useAuthStore()
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <h1 class="text-lg font-semibold text-gray-900 mb-1">Admin Dashboard</h1>
    <p class="text-sm text-gray-500 mb-6">Welcome, {{ auth.user?.name }}.</p>

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <RouterLink
        to="/sessions"
        class="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-4 hover:border-indigo-300 transition-colors"
      >
        <span class="font-medium text-gray-900 text-sm">Sessions</span>
        <span class="text-xs text-gray-500">View, create, and manage coaching sessions</span>
      </RouterLink>
      <RouterLink
        to="/admin/users"
        class="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-4 hover:border-indigo-300 transition-colors"
      >
        <span class="font-medium text-gray-900 text-sm">Users</span>
        <span class="text-xs text-gray-500">Manage students, teachers, and admins</span>
      </RouterLink>
      <RouterLink
        to="/payments/review"
        class="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-4 hover:border-indigo-300 transition-colors"
      >
        <span class="font-medium text-gray-900 text-sm">Payment Review</span>
        <span class="text-xs text-gray-500">Approve or reject student payment receipts</span>
      </RouterLink>
      <RouterLink
        to="/admin/config/fee"
        class="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-4 hover:border-indigo-300 transition-colors"
      >
        <span class="font-medium text-gray-900 text-sm">Fee Configuration</span>
        <span class="text-xs text-gray-500">Set the global session fee</span>
      </RouterLink>
    </div>
  </div>
</template>
