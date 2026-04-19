<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { useRouter } from 'vue-router'
import type { Role } from '@/stores/authStore'

const auth = useAuthStore()
const router = useRouter()

const ROLE_HOME: Record<Role, string> = {
  admin: '/admin',
  teacher: '/teacher',
  student: '/student',
  coach: '/login',
}

const dashboardPath = computed(() =>
  auth.user ? ROLE_HOME[auth.user.role] : '/login',
)

async function handleLogout() {
  await auth.logout()
  router.push('/login')
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <header class="bg-white border-b border-gray-200 shadow-sm">
      <div class="flex items-center justify-between px-4 py-3">
        <div class="flex items-center gap-3">
          <img src="@/assets/logo-transparent.png" alt="STF Supreme Chess" class="h-8 w-auto" />
          <span class="font-semibold text-gray-900 text-sm hidden sm:inline">STF Supreme Chess</span>
        </div>
        <nav class="flex items-center gap-4 text-sm">
          <RouterLink
            to="/sessions"
            class="text-gray-600 hover:text-indigo-600"
            active-class="text-indigo-600 font-medium"
          >
            Sessions
          </RouterLink>
          <RouterLink
            :to="dashboardPath"
            class="text-gray-600 hover:text-indigo-600"
          >
            Dashboard
          </RouterLink>
          <button class="text-gray-600 hover:text-gray-900" @click="handleLogout">
            Logout
          </button>
        </nav>
      </div>
    </header>
    <main class="p-4">
      <RouterView />
    </main>
  </div>
</template>
