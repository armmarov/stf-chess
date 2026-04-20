<script setup lang="ts">
import { useAuthStore } from '@/stores/authStore'
import { useRouter } from 'vue-router'
import AppHeaderNav from '@/components/AppHeaderNav.vue'
import type { NavLink } from '@/components/AppHeaderNav.vue'

const auth = useAuthStore()
const router = useRouter()

const links: NavLink[] = [
  { label: 'Dashboard', to: '/admin', exact: true, icon: 'home' },
  { label: 'Sessions', to: '/sessions', icon: 'calendar' },
  { label: 'Tournaments', to: '/tournaments', icon: 'trophy' },
  { label: 'Polls', to: '/polls', icon: 'clipboard' },
  { label: 'Resources', to: '/resources', icon: 'book' },
  { label: 'Users', to: '/admin/users', icon: 'users' },
  { label: 'Payments', to: '/payments/review', icon: 'dollar' },
  { label: 'Fee', to: '/admin/config/fee', icon: 'settings' },
  { label: 'Profile', to: '/profile', icon: 'user-circle' },
  { label: 'About', to: '/about', icon: 'info' },
]

async function handleLogout() {
  await auth.logout()
  router.push('/login')
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <AppHeaderNav :links="links" @logout="handleLogout" />
    <main class="p-4">
      <RouterView />
    </main>
  </div>
</template>
