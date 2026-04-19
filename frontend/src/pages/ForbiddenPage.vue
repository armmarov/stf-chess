<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'

const auth = useAuthStore()
const router = useRouter()

function goHome() {
  const role = auth.user?.role
  if (role === 'admin') router.push('/admin')
  else if (role === 'teacher') router.push('/teacher')
  else if (role === 'student') router.push('/student')
  else router.push('/login')
}
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
    <h1 class="text-4xl font-bold text-gray-900">403</h1>
    <p class="text-gray-500">You don't have permission to view this page.</p>
    <button class="text-indigo-600 underline text-sm" @click="goHome">Go to my dashboard</button>
  </div>
</template>
