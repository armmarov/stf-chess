<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { useRouter } from 'vue-router'
import type { Role } from '@/stores/authStore'
import AppHeaderNav from '@/components/AppHeaderNav.vue'
import type { NavLink } from '@/components/AppHeaderNav.vue'

const auth = useAuthStore()
const router = useRouter()

const ROLE_HOME: Record<Role, string> = {
  admin: '/admin',
  teacher: '/teacher',
  student: '/student',
  coach: '/login',
}

const links = computed<NavLink[]>(() => {
  const role = auth.user?.role
  const dashboardTo = auth.user ? ROLE_HOME[auth.user.role] : '/login'

  const base: NavLink[] = [
    { label: 'Dashboard', to: dashboardTo, exact: true },
    { label: 'Sessions', to: '/sessions' },
  ]

  if (role === 'admin') {
    base.push(
      { label: 'Users', to: '/admin/users' },
      { label: 'Payments', to: '/payments/review' },
      { label: 'Fee', to: '/admin/config/fee' },
    )
  } else if (role === 'teacher') {
    base.push(
      { label: 'Students', to: '/teacher/students' },
      { label: 'Payments', to: '/payments/review' },
    )
  } else if (role === 'student') {
    base.push({ label: 'Payments', to: '/student/payments' })
  }

  return base
})

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
