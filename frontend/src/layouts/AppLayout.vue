<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { useRouter } from 'vue-router'
import type { Role } from '@/stores/authStore'
import AppHeaderNav from '@/components/AppHeaderNav.vue'
import type { NavItem } from '@/components/AppHeaderNav.vue'

const auth = useAuthStore()
const router = useRouter()

const ROLE_HOME: Record<Role, string> = {
  admin: '/admin',
  teacher: '/teacher',
  student: '/student',
  coach: '/login',
}

const items = computed<NavItem[]>(() => {
  const role = auth.user?.role
  const dashboardTo = auth.user ? ROLE_HOME[auth.user.role] : '/login'

  const out: NavItem[] = [
    { label: 'Dashboard', to: dashboardTo, exact: true, icon: 'home' },
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
  ]

  if (role === 'admin') {
    out.push({
      label: 'Manage',
      icon: 'settings',
      children: [
        { label: 'Users', to: '/admin/users', icon: 'users' },
        { label: 'Payments', to: '/payments/review', icon: 'dollar' },
        { label: 'Fee', to: '/admin/config/fee', icon: 'settings' },
      ],
    })
  } else if (role === 'teacher') {
    out.push({
      label: 'Manage',
      icon: 'settings',
      children: [
        { label: 'Students', to: '/teacher/students', icon: 'users' },
        { label: 'Payments', to: '/payments/review', icon: 'dollar' },
      ],
    })
  } else if (role === 'student') {
    out.push({ label: 'Payments', to: '/student/payments', icon: 'dollar' })
  }

  out.push({ label: 'Profile', to: '/profile', icon: 'user-circle' })
  out.push({ label: 'About', to: '/about', icon: 'info' })

  return out
})

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
