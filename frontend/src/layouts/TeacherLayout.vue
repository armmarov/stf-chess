<script setup lang="ts">
import { useAuthStore } from '@/stores/authStore'
import { useRouter } from 'vue-router'
import AppHeaderNav from '@/components/AppHeaderNav.vue'
import type { NavItem } from '@/components/AppHeaderNav.vue'

const auth = useAuthStore()
const router = useRouter()

const items: NavItem[] = [
  { label: 'Dashboard', to: '/teacher', exact: true, icon: 'home' },
  {
    label: 'Club',
    icon: 'calendar',
    children: [
      { label: 'Sessions', to: '/sessions', icon: 'calendar' },
      { label: 'Tournaments', to: '/tournaments', icon: 'trophy' },
      { label: 'Polls', to: '/polls', icon: 'clipboard' },
      { label: 'Records', to: '/records', icon: 'award' },
    ],
  },
  {
    label: 'Learn',
    icon: 'book',
    children: [
      { label: 'Resources', to: '/resources', icon: 'book' },
      { label: 'Games', to: '/games', icon: 'chess' },
      { label: 'Puzzle', to: '/puzzle', icon: 'puzzle' },
    ],
  },
  {
    label: 'Manage',
    icon: 'settings',
    children: [
      { label: 'Students', to: '/teacher/students', icon: 'users' },
      { label: 'Payments', to: '/payments/review', icon: 'dollar' },
    ],
  },
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
    <AppHeaderNav :items="items" @logout="handleLogout" />
    <main class="p-4">
      <RouterView />
    </main>
  </div>
</template>
